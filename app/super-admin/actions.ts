"use server"

import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"

export async function createTenantAction(prevState: any, formData: FormData) {
  const name = formData.get("name")?.toString().trim()
  const subdomain = formData.get("subdomain")?.toString().trim().toLowerCase()
  const adminEmail = formData.get("admin_email")?.toString().trim().toLowerCase()

  if (!name || !subdomain || !adminEmail) {
    return { success: false, error: "Le nom, le sous-domaine et l'e-mail de l'administrateur sont requis." }
  }

  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(adminEmail)) {
    return { success: false, error: "Adresse e-mail de l'administrateur invalide." }
  }

  // Subdomain regex validation: 3 to 63 lowercase alphanumeric characters and hyphens
  const subdomainRegex = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/
  if (!subdomainRegex.test(subdomain)) {
    return {
      success: false,
      error: "Format de sous-domaine invalide. Seuls les lettres minuscules, chiffres et tirets sont autorisés (3 à 63 caractères)."
    }
  }

  const supabase = await createClient()

  // Get current authenticated user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { success: false, error: "Utilisateur non authentifié." }
  }

  // Call atomic PostgreSQL RPC function (creates tenant with status = 'pending')
  const { data: rpcRes, error } = await supabase.rpc("create_tenant_with_subscription", {
    p_name: name,
    p_subdomain: subdomain,
    p_admin_id: user.id
  })

  if (error) {
    if (error.message.includes("not_authorized") || error.code === "42501") {
      return { success: false, error: "You are not authorized to perform this action." }
    }
    if (error.message.includes("subdomain_already_in_use") || error.code === "23505") {
      return { success: false, error: "This subdomain is already in use" }
    }
    if (error.message.includes("invalid_subdomain_format")) {
      return { success: false, error: "Format de sous-domaine invalide." }
    }
    return { success: false, error: error.message || "Erreur lors de la création du cabinet." }
  }

  const tenantId = (rpcRes as { tenant_id: string })?.tenant_id

  // Service-role admin client created strictly for sending the invite
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

  // Send invite email to the new cabinet_admin
  const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    adminEmail,
    {
      redirectTo: `${siteUrl}/accept-invite`,
      data: {
        role: "cabinet_admin",
        tenant_id: tenantId
      }
    }
  )

  if (inviteError) {
    console.error("createTenantAction invite error:", inviteError)
    // Non-fatal for tenant creation, but inform super_admin
    return {
      success: true,
      error: `Cabinet créé (en attente), mais l'envoi de l'e-mail a échoué: ${inviteError.message}`
    }
  }

  revalidatePath("/super-admin/tenants")
  revalidatePath("/super-admin")
  revalidatePath("/super-admin/logs")

  return { success: true, error: null }
}

export async function updateTenantStatusAction(tenantId: string, tenantName: string, status: "active" | "suspended") {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { success: false, error: "Utilisateur non authentifié." }
  }

  // Update tenant status via SECURITY DEFINER RPC with internal authorization check (super_admin or tenants:manage)
  // OLD CHECK: if (!userProfile || userProfile.role !== "super_admin") ... await supabase.from("tenants").update({ status })
  const { data: updateSuccess, error: updateError } = await supabase.rpc("update_tenant_status", {
    p_tenant_id: tenantId,
    p_status: status
  })

  if (updateError) {
    return { success: false, error: updateError.message === "not_authorized" ? "You are not authorized to perform this action." : updateError.message }
  }

  if (!updateSuccess) {
    return { success: false, error: "Update failed or not authorized." }
  }

  // Insert audit log
  const actionText = status === "suspended" 
    ? `tenant_suspended: ${tenantName} (${tenantId})` 
    : `tenant_activated: ${tenantName} (${tenantId})`

  await supabase.from("logs").insert({
    user_id: user.id,
    action: actionText
  })

  revalidatePath("/super-admin/tenants")
  revalidatePath("/super-admin")
  revalidatePath("/super-admin/logs")

  return { success: true, error: null }
}

export async function updateSubscriptionAction(
  subscriptionId: string,
  tenantId: string,
  tenantName: string,
  plan: string,
  status: "active" | "trial" | "suspended"
) {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { success: false, error: "Utilisateur non authentifié." }
  }

  // Defense-in-depth: Verify calling user has 'tenants:manage' permission (or super_admin bypass)
  // OLD CHECK: if (!userProfile || userProfile.role !== "super_admin")
  const { data: isAuthorized } = await supabase.rpc("can_perform", { perm_key: "tenants:manage" })

  if (!isAuthorized) {
    return { success: false, error: "You are not authorized to perform this action." }
  }

  // Resolve plan_id matching the plan slug
  const { data: planRow } = await supabase
    .from("plans")
    .select("id")
    .eq("slug", plan.toLowerCase().trim())
    .maybeSingle()

  // Update subscription plan_legacy, plan_id, & status and check returned affected rows
  const { data: updatedSubscriptions, error: updateError } = await supabase
    .from("subscriptions")
    .update({
      plan_legacy: plan,
      plan_id: planRow?.id || null,
      status
    })
    .eq("id", subscriptionId)
    .select()

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  if (!updatedSubscriptions || updatedSubscriptions.length === 0) {
    return { success: false, error: "Update failed or not authorized." }
  }

  // Insert audit log
  await supabase.from("logs").insert({
    user_id: user.id,
    action: `subscription_plan_changed: ${tenantName} -> plan=${plan}, status=${status}`
  })

  revalidatePath("/super-admin/tenants")
  revalidatePath("/super-admin")
  revalidatePath("/super-admin/logs")

  return { success: true, error: null }
}
