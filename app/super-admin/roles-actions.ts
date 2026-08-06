"use server"

import { createClient as createServerSupabaseClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"

/**
 * Defense-in-depth authorization check for Super Admin.
 */
async function verifySuperAdmin() {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return { user: null, error: "Utilisateur non authentifié." }
  }

  // Defense-in-depth authorization check: verify caller has a platform management role
  // OLD CHECK: if (!profile || profile.role !== "super_admin")
  const { data: isPlatformRole, error: roleErr } = await supabase.rpc("is_platform_role")

  if (roleErr || !isPlatformRole) {
    return { user: null, error: "Vous n'êtes pas autorisé à effectuer cette action." }
  }

  return { user, error: null }
}

/**
 * Creates a new custom role (is_system = false, is_platform_role = false, tenant_id = NULL).
 */
export async function createRoleAction(name: string, isPlatformRole: boolean = false) {
  const { user, error: authErr } = await verifySuperAdmin()
  if (authErr || !user) {
    return { success: false, error: authErr }
  }

  const trimmedName = name.trim().toLowerCase().replace(/\s+/g, "_")
  if (!trimmedName) {
    return { success: false, error: "Le nom du rôle est requis." }
  }

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  // Check if role name already exists
  const { data: existingRole } = await supabaseAdmin
    .from("roles")
    .select("id")
    .eq("name", trimmedName)
    .maybeSingle()

  if (existingRole) {
    return { success: false, error: "Un rôle avec ce nom existe déjà." }
  }

  const { data: newRole, error: insertErr } = await supabaseAdmin
    .from("roles")
    .insert({
      name: trimmedName,
      is_system: false,
      is_platform_role: isPlatformRole,
      tenant_id: null,
    })
    .select()
    .single()

  if (insertErr) {
    return { success: false, error: insertErr.message || "Impossible de créer le rôle." }
  }

  // Insert audit log
  await supabaseAdmin.from("logs").insert({
    user_id: user.id,
    action: `role_created: ${trimmedName}`,
  })

  revalidatePath("/super-admin/roles")
  return { success: true, error: null, role: newRole }
}

/**
 * Deletes a custom role after verifying it is not a system role and not assigned to any users.
 */
export async function deleteRoleAction(roleId: string) {
  const { user, error: authErr } = await verifySuperAdmin()
  if (authErr || !user) {
    return { success: false, error: authErr }
  }

  if (!roleId) {
    return { success: false, error: "L'identifiant du rôle est requis." }
  }

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  // Check role details
  const { data: targetRole } = await supabaseAdmin
    .from("roles")
    .select("id, name, is_system")
    .eq("id", roleId)
    .maybeSingle()

  if (!targetRole) {
    return { success: false, error: "Rôle non trouvé." }
  }

  if (targetRole.is_system) {
    return { success: false, error: "Impossible de supprimer un rôle système." }
  }

  // Check if any users are assigned to this role
  const { count: assignedUsersCount } = await supabaseAdmin
    .from("users")
    .select("*", { count: "exact", head: true })
    .eq("role_id", roleId)

  if (assignedUsersCount && assignedUsersCount > 0) {
    return {
      success: false,
      error: `Ce rôle est encore assigné à ${assignedUsersCount} utilisateur(s).`,
    }
  }

  const { error: deleteErr } = await supabaseAdmin
    .from("roles")
    .delete()
    .eq("id", roleId)

  if (deleteErr) {
    return { success: false, error: deleteErr.message || "Échec de la suppression." }
  }

  // Insert audit log
  await supabaseAdmin.from("logs").insert({
    user_id: user.id,
    action: `role_deleted: ${targetRole.name}`,
  })

  revalidatePath("/super-admin/roles")
  return { success: true, error: null }
}

/**
 * Atomically updates the full set of permission IDs assigned to a role.
 */
export async function updateRolePermissionsAction(roleId: string, permissionIds: string[]) {
  const { user, error: authErr } = await verifySuperAdmin()
  if (authErr || !user) {
    return { success: false, error: authErr }
  }

  if (!roleId) {
    return { success: false, error: "L'identifiant du rôle est requis." }
  }

  const supabase = await createServerSupabaseClient()
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  // Fetch role name for audit log
  const { data: targetRole } = await supabaseAdmin
    .from("roles")
    .select("name")
    .eq("id", roleId)
    .maybeSingle()

  if (!targetRole) {
    return { success: false, error: "Rôle non trouvé." }
  }

  // Call atomic RPC function to update role permissions via authenticated caller client (supabase)
  const { error: rpcErr } = await supabase.rpc("update_role_permissions", {
    p_role_id: roleId,
    p_permission_ids: permissionIds || [],
  })

  if (rpcErr) {
    if (rpcErr.message.includes("not_authorized") || rpcErr.code === "42501") {
      return { success: false, error: "Vous n'êtes pas autorisé à effectuer cette action." }
    }
    return { success: false, error: rpcErr.message || "Échec de la mise à jour des permissions." }
  }

  // Insert audit log
  await supabaseAdmin.from("logs").insert({
    user_id: user.id,
    action: `role_permissions_updated: ${targetRole.name}`,
  })

  revalidatePath("/super-admin/roles")
  return { success: true, error: null }
}
