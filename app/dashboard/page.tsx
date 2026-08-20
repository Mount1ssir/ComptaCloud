import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { BrandingPromptBanner } from "@/components/branding-prompt-banner"

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth")
  }

  // Resolve user tenant and role
  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id, role_id, roles(name), tenants(brand_logo_url, brand_primary_color, branding_prompt_dismissed)")
    .eq("id", user.id)
    .maybeSingle()

  const rolesData = profile?.roles as unknown
  const roleName = Array.isArray(rolesData)
    ? (rolesData[0] as { name: string } | undefined)?.name || null
    : (rolesData as { name: string } | null)?.name || null

  const isCabinetAdmin = roleName === "cabinet_admin"

  // Check plan entitlement for branding
  const { data: isEntitled } = await supabase.rpc("can_perform_with_plan", {
    p_perm_key: "branding:customize"
  })

  const tenantData = profile?.tenants as unknown
  const tenantObj = Array.isArray(tenantData) ? tenantData[0] : tenantData
  const promptDismissed = tenantObj?.branding_prompt_dismissed === true
  const hasLogo = !!tenantObj?.brand_logo_url
  const hasPrimaryColor = !!tenantObj?.brand_primary_color

  const showBrandingPrompt = isCabinetAdmin && isEntitled && !promptDismissed && !hasLogo && !hasPrimaryColor

  return (
    <main className="flex-1 space-y-6 p-6 max-w-7xl mx-auto w-full">
      {showBrandingPrompt && <BrandingPromptBanner />}

      <div className="rounded-xl border bg-card p-8 text-center space-y-2 shadow-xs">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Tableau de bord Cabinet</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Bienvenue dans votre espace cabinet. Utilisez la barre de navigation ci-dessus pour gérer vos clients, votre équipe et les réglages du cabinet.
        </p>
      </div>
    </main>
  )
}
