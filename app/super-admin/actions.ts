"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function createTenantAction(prevState: any, formData: FormData) {
  const name = formData.get("name")?.toString().trim()
  const subdomain = formData.get("subdomain")?.toString().trim().toLowerCase()

  if (!name || !subdomain) {
    return { success: false, error: "Le nom et le sous-domaine sont requis." }
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

  // Call atomic PostgreSQL RPC function
  const { data, error } = await supabase.rpc("create_tenant_with_subscription", {
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

  // Explicit defense-in-depth role check: verify caller is super_admin
  const { data: userProfile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (!userProfile || userProfile.role !== "super_admin") {
    return { success: false, error: "You are not authorized to perform this action." }
  }

  // Update tenant status & check returned affected rows
  const { data: updatedTenants, error: updateError } = await supabase
    .from("tenants")
    .update({ status })
    .eq("id", tenantId)
    .select()

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  if (!updatedTenants || updatedTenants.length === 0) {
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

  // Explicit defense-in-depth role check: verify caller is super_admin
  const { data: userProfile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (!userProfile || userProfile.role !== "super_admin") {
    return { success: false, error: "You are not authorized to perform this action." }
  }

  // Update subscription plan & status and check returned affected rows
  const { data: updatedSubscriptions, error: updateError } = await supabase
    .from("subscriptions")
    .update({ plan, status })
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
