"use server"

import { createClient as createServerSupabaseClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"

export async function inviteStaffAction(formData: FormData) {
  const email = formData.get("email")?.toString().trim().toLowerCase()
  const role = formData.get("role")?.toString().trim()

  if (!email || !role) {
    return { success: false, error: "L'adresse e-mail et le rôle sont requis." }
  }

  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return { success: false, error: "Adresse e-mail invalide." }
  }

  // Authenticate calling user
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return { success: false, error: "Utilisateur non authentifié." }
  }

  // Strict role validation: Submitted role MUST exist, MUST be a cabinet-scoped role (is_platform_role = false), and MUST NOT be 'client'
  const { data: roleRow, error: roleError } = await supabase
    .from("roles")
    .select("id, name, is_platform_role")
    .eq("name", role)
    .maybeSingle()

  if (roleError || !roleRow || roleRow.is_platform_role === true || roleRow.name === "client") {
    return {
      success: false,
      error: "Rôle invalide ou non autorisé pour les membres de cabinet."
    }
  }

  // Fetch calling user profile to get tenant_id for invited user metadata
  const { data: callerProfile, error: profileError } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .maybeSingle()

  // Defense-in-depth: Verify calling user has 'team:invite' permission (or super_admin bypass)
  const { data: isAuthorized } = await supabase.rpc("can_perform", { perm_key: "team:invite" })

  if (profileError || !callerProfile || !isAuthorized) {
    return { success: false, error: "Vous n'êtes pas autorisé à effectuer cette action." }
  }

  if (!callerProfile.tenant_id) {
    return { success: false, error: "Aucun cabinet associé à votre compte." }
  }

  // Check plan quota limits for team member invitations (Fail-Closed, runs for EVERY role)
  const { data: limitResult, error: limitError } = await supabase.rpc("check_plan_limit", {
    p_limit_key: "max_accountants"
  })

  const limitData = limitResult as { allowed?: boolean; message?: string } | null

  if (limitError || !limitData || limitData.allowed === false) {
    return {
      success: false,
      error: limitData?.message || limitError?.message || "Limite de membres d'équipe atteinte pour votre forfait."
    }
  }

  // Service-role admin client created strictly for the single inviteUserByEmail call
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

  const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    email,
    {
      redirectTo: `${siteUrl}/accept-invite`,
      data: {
        role,
        tenant_id: callerProfile.tenant_id
      }
    }
  )

  if (inviteError) {
    const errorMsg = inviteError.message?.toLowerCase() || ""
    if (errorMsg.includes("already registered") || errorMsg.includes("already exists") || errorMsg.includes("unique")) {
      return { success: false, error: "Cet e-mail est déjà enregistré." }
    }
    return { success: false, error: inviteError.message || "Échec de l'envoi de l'invitation." }
  }

  // Insert audit log row
  await supabase.from("logs").insert({
    user_id: user.id,
    action: `staff_invited: ${email} as ${role}`
  })

  revalidatePath("/dashboard/team")

  return { success: true, error: null }
}

export async function updateTeamMemberTitleAction(targetUserId: string, title: string) {
  if (!targetUserId) {
    return { success: false, error: "L'identifiant utilisateur est requis." }
  }

  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return { success: false, error: "Utilisateur non authentifié." }
  }

  // Defense-in-depth: Verify calling user has 'team:update_title' permission (or super_admin bypass)
  // OLD CHECK: if (!callerProfile || callerProfile.role !== "cabinet_admin")
  const { data: isAuthorized } = await supabase.rpc("can_perform", { perm_key: "team:update_title" })

  if (!isAuthorized) {
    return { success: false, error: "Vous n'êtes pas autorisé à effectuer cette action." }
  }

  const trimmedTitle = title.trim()

  // Update title using regular authenticated client (subject to column-level GRANT + RLS)
  const { data: updatedUsers, error: updateError } = await supabase
    .from("users")
    .update({ title: trimmedTitle === "" ? null : trimmedTitle })
    .eq("id", targetUserId)
    .select()

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  if (!updatedUsers || updatedUsers.length === 0) {
    return { success: false, error: "Mise à jour échouée ou non autorisée." }
  }

  revalidatePath("/dashboard/team")

  return { success: true, error: null }
}

export async function disconnectDriveAction() {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return { success: false, error: "Utilisateur non authentifié." }
  }

  // Fetch calling user profile to get tenant_id for Drive disconnect query
  const { data: callerProfile } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .maybeSingle()

  // Defense-in-depth: Verify calling user has 'drive:disconnect' permission AND plan authorization (or super_admin bypass)
  const { data: isAuthorized } = await supabase.rpc("can_perform_with_plan", { p_perm_key: "drive:disconnect" })

  if (!callerProfile || !callerProfile.tenant_id || !isAuthorized) {
    return { success: false, error: "Vous n'êtes pas autorisé à effectuer cette action." }
  }

  const encryptionKey = process.env.DRIVE_TOKEN_ENCRYPTION_KEY!

  // Attempt to decrypt refresh token to revoke on Google side
  if (encryptionKey) {
    try {
      const { data: refreshToken } = await supabase.rpc("get_tenant_drive_refresh_token", {
        p_tenant_id: callerProfile.tenant_id,
        p_encryption_key: encryptionKey
      })

      if (refreshToken) {
        // Revoke token with Google
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" }
        })
      }
    } catch (e) {
      console.warn("Failed to revoke token on Google side during disconnect:", e)
    }
  }

  // Clear Drive connection columns on tenant row
  const { data: updatedTenants, error: updateError } = await supabase
    .from("tenants")
    .update({
      google_drive_connected: false,
      google_drive_refresh_token_encrypted: null,
      google_drive_connected_at: null,
      google_drive_account_email: null
    })
    .eq("id", callerProfile.tenant_id)
    .select()

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  if (!updatedTenants || updatedTenants.length === 0) {
    return { success: false, error: "Échec de la déconnexion Google Drive." }
  }

  // Insert audit log
  await supabase.from("logs").insert({
    user_id: user.id,
    action: "drive_disconnected"
  })

  revalidatePath("/dashboard/settings/storage")

  return { success: true, error: null }
}

