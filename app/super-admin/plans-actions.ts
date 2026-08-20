"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface PlanFormData {
  id?: string
  name: string
  slug: string
  description?: string
  price_monthly: number
  currency?: string
  tier_rank: number
  is_active: boolean
  is_recommended?: boolean
  permission_keys: string[]
  max_accountants: number
  max_storage_gb?: number
  max_clients?: number
}

export async function createPlanAction(data: PlanFormData) {
  const supabase = await createClient()

  // 1. Authenticate calling user session
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { success: false, error: "Utilisateur non authentifié." }
  }

  // 2. Defense-in-depth authorization check: is_platform_role()
  const { data: isAuthorized, error: authError } = await supabase.rpc("is_platform_role")
  if (authError || !isAuthorized) {
    return { success: false, error: "Vous n'êtes pas autorisé à effectuer cette action." }
  }

  // 3. Format & validate inputs
  const trimmedName = data.name.trim()
  const trimmedSlug = data.slug.trim().toLowerCase()

  if (!trimmedName || !trimmedSlug) {
    return { success: false, error: "Le nom et le slug du forfait sont requis." }
  }

  const slugRegex = /^[a-z0-9-]+$/
  if (!slugRegex.test(trimmedSlug)) {
    return { success: false, error: "Le slug ne peut contenir que des lettres minuscules, des chiffres et des tirets." }
  }

  // Check unique tier_rank conflict ahead of DB to give clear error
  const { data: existingTier } = await supabase
    .from("plans")
    .select("id, name")
    .eq("tier_rank", data.tier_rank)
    .maybeSingle()

  if (existingTier) {
    return { success: false, error: `Le rang ${data.tier_rank} est déjà attribué au forfait "${existingTier.name}".` }
  }

  // 4. Call atomic SECURITY DEFINER RPC
  const { data: rpcRes, error: rpcErr } = await supabase.rpc("upsert_plan_details", {
    p_plan_id: null,
    p_name: trimmedName,
    p_slug: trimmedSlug,
    p_description: data.description?.trim() || null,
    p_price_monthly: data.price_monthly ?? 0,
    p_currency: data.currency?.trim() || "MAD",
    p_tier_rank: data.tier_rank,
    p_is_active: data.is_active,
    p_permission_keys: data.permission_keys || [],
    p_max_accountants: data.max_accountants ?? 2,
    p_max_storage_gb: data.max_storage_gb ?? -1,
    p_is_recommended: data.is_recommended ?? false,
    p_max_clients: data.max_clients ?? 10
  })

  if (rpcErr) {
    const msg = rpcErr.message?.toLowerCase() || ""
    if (msg.includes("slug_already_exists") || msg.includes("unique")) {
      return { success: false, error: "Ce slug de forfait est déjà utilisé." }
    }
    return { success: false, error: rpcErr.message || "Échec de la création du forfait." }
  }

  // 5. Insert Audit Log
  await supabase.from("logs").insert({
    user_id: user.id,
    action: `plan_created: ${trimmedName} (${trimmedSlug})`
  })

  revalidatePath("/super-admin/plans")
  return { success: true, error: null }
}

export async function updatePlanAction(planId: string, data: PlanFormData) {
  const supabase = await createClient()

  // 1. Authenticate calling user session
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { success: false, error: "Utilisateur non authentifié." }
  }

  // 2. Defense-in-depth authorization check: is_platform_role()
  const { data: isAuthorized, error: authError } = await supabase.rpc("is_platform_role")
  if (authError || !isAuthorized) {
    return { success: false, error: "Vous n'êtes pas autorisé à effectuer cette action." }
  }

  if (!planId) {
    return { success: false, error: "Identifiant du forfait requis." }
  }

  const trimmedName = data.name.trim()
  const trimmedSlug = data.slug.trim().toLowerCase()

  if (!trimmedName || !trimmedSlug) {
    return { success: false, error: "Le nom et le slug du forfait sont requis." }
  }

  const slugRegex = /^[a-z0-9-]+$/
  if (!slugRegex.test(trimmedSlug)) {
    return { success: false, error: "Le slug ne peut contenir que des lettres minuscules, des chiffres et des tirets." }
  }

  // Check unique tier_rank conflict against other plans
  const { data: existingTier } = await supabase
    .from("plans")
    .select("id, name")
    .eq("tier_rank", data.tier_rank)
    .neq("id", planId)
    .maybeSingle()

  if (existingTier) {
    return { success: false, error: `Le rang ${data.tier_rank} est déjà attribué au forfait "${existingTier.name}".` }
  }

  // 3. Call atomic SECURITY DEFINER RPC
  const { data: rpcRes, error: rpcErr } = await supabase.rpc("upsert_plan_details", {
    p_plan_id: planId,
    p_name: trimmedName,
    p_slug: trimmedSlug,
    p_description: data.description?.trim() || null,
    p_price_monthly: data.price_monthly ?? 0,
    p_currency: data.currency?.trim() || "MAD",
    p_tier_rank: data.tier_rank,
    p_is_active: data.is_active,
    p_permission_keys: data.permission_keys || [],
    p_max_accountants: data.max_accountants ?? 2,
    p_max_storage_gb: data.max_storage_gb ?? -1,
    p_is_recommended: data.is_recommended ?? false,
    p_max_clients: data.max_clients ?? 10
  })

  if (rpcErr) {
    const msg = rpcErr.message?.toLowerCase() || ""
    if (msg.includes("slug_already_exists") || msg.includes("unique")) {
      return { success: false, error: "Ce slug de forfait est déjà utilisé." }
    }
    return { success: false, error: rpcErr.message || "Échec de la modification du forfait." }
  }

  // 4. Insert Audit Log
  await supabase.from("logs").insert({
    user_id: user.id,
    action: `plan_updated: ${trimmedName} (${trimmedSlug})`
  })

  revalidatePath("/super-admin/plans")
  return { success: true, error: null }
}

export async function togglePlanStatusAction(planId: string, isActive: boolean) {
  const supabase = await createClient()

  // 1. Authenticate calling user session
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { success: false, error: "Utilisateur non authentifié." }
  }

  // 2. Defense-in-depth authorization check: is_platform_role()
  const { data: isAuthorized, error: authError } = await supabase.rpc("is_platform_role")
  if (authError || !isAuthorized) {
    return { success: false, error: "Vous n'êtes pas autorisé à effectuer cette action." }
  }

  if (!planId) {
    return { success: false, error: "Identifiant du forfait requis." }
  }

  const { error: updateErr } = await supabase
    .from("plans")
    .update({ is_active: isActive })
    .eq("id", planId)

  if (updateErr) {
    return { success: false, error: updateErr.message }
  }

  await supabase.from("logs").insert({
    user_id: user.id,
    action: `plan_status_toggled: ${planId} -> is_active=${isActive}`
  })

  revalidatePath("/super-admin/plans")
  return { success: true, error: null }
}

export async function deletePlanAction(planId: string) {
  const supabase = await createClient()

  // 1. Authenticate calling user session
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { success: false, error: "Utilisateur non authentifié." }
  }

  // 2. Defense-in-depth authorization check: is_platform_role()
  const { data: isAuthorized, error: authError } = await supabase.rpc("is_platform_role")
  if (authError || !isAuthorized) {
    return { success: false, error: "Vous n'êtes pas autorisé à effectuer cette action." }
  }

  if (!planId) {
    return { success: false, error: "Identifiant du forfait requis." }
  }

  // 3. Live check: Verify ZERO subscriptions (active or historical) reference this plan_id
  const { count, error: subCountErr } = await supabase
    .from("subscriptions")
    .select("*", { count: "exact", head: true })
    .eq("plan_id", planId)

  if (subCountErr) {
    return { success: false, error: subCountErr.message }
  }

  if (count && count > 0) {
    return {
      success: false,
      error: `Impossible de supprimer ce forfait car ${count} abonnement(s) y sont associés. Vous pouvez le désactiver à la place.`
    }
  }

  // 4. Delete plan record (cascades plan_permissions and plan_limits)
  const { error: deleteErr } = await supabase
    .from("plans")
    .delete()
    .eq("id", planId)

  if (deleteErr) {
    const msg = deleteErr.message?.toLowerCase() || ""
    if (msg.includes("foreign key") || deleteErr.code === "23503") {
      return { success: false, error: "Impossible de supprimer ce forfait car des abonnements y sont associés." }
    }
    return { success: false, error: deleteErr.message || "Échec de la suppression du forfait." }
  }

  // 5. Insert Audit Log
  await supabase.from("logs").insert({
    user_id: user.id,
    action: `plan_deleted: ${planId}`
  })

  revalidatePath("/super-admin/plans")
  return { success: true, error: null }
}
