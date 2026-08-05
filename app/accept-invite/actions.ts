"use server"

import { createClient as createServerSupabaseClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

export async function activateTenantAction() {
  const supabase = await createServerSupabaseClient()

  // 1. Get current authenticated user session
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { success: false, error: "Utilisateur non authentifié." }
  }

  // 2. Fetch user profile to verify tenant_id and cabinet_admin role
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("tenant_id, role_id, roles(name)")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError || !profile || !profile.tenant_id) {
    return { success: false, error: "Cabinet introuvable." }
  }

  const rolesData = profile.roles as unknown
  const roleName = Array.isArray(rolesData)
    ? (rolesData[0] as { name: string } | undefined)?.name || null
    : (rolesData as { name: string } | null)?.name || null

  if (roleName !== "cabinet_admin") {
    // Non-admin staff (accountants, clients) joining an active cabinet do not perform tenant activation
    return { success: true, activated: false }
  }

  // 3. Service-role admin client created strictly to bypass direct table UPDATE restriction on tenants
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  // 4. Transition tenant status from 'pending' to 'active'
  const { error: updateError } = await supabaseAdmin
    .from("tenants")
    .update({ status: "active" })
    .eq("id", profile.tenant_id)
    .eq("status", "pending")

  if (updateError) {
    console.error("activateTenantAction error:", updateError)
    return { success: false, error: updateError.message }
  }

  return { success: true }
}
