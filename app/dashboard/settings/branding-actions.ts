"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function updateBrandingAction(formData: FormData) {
  const supabase = await createClient()

  // 1. Authenticate calling user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { success: false, error: "Utilisateur non authentifié." }
  }

  const logoUrl = formData.get("logoUrl")?.toString().trim() || ""
  const primaryColor = formData.get("primaryColor")?.toString().trim() || ""
  const secondaryColor = formData.get("secondaryColor")?.toString().trim() || ""

  // 2. Execute update_tenant_branding RPC
  const { data, error } = await supabase.rpc("update_tenant_branding", {
    p_logo_url: logoUrl,
    p_primary_color: primaryColor,
    p_secondary_color: secondaryColor
  })

  if (error) {
    return {
      success: false,
      error: error.message || "Impossible de mettre à jour la personnalisation de la marque."
    }
  }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/settings/branding")

  return {
    success: true,
    data
  }
}

export async function dismissBrandingPromptAction() {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { success: false, error: "Utilisateur non authentifié." }
  }

  const { error } = await supabase.rpc("dismiss_branding_prompt")
  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/dashboard")
  return { success: true }
}
