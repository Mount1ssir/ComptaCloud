import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { BrandingForm } from "@/components/branding-form"
import { Sparkles, Lock, ArrowUpRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export default async function BrandingSettingsPage() {
  const supabase = await createClient()

  // 1. Authenticate calling user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect("/auth")
  }

  // 2. Fetch user profile & tenant ID
  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile || !profile.tenant_id) {
    redirect("/dashboard")
  }

  // 3. Check entitlement via can_perform_with_plan('branding:customize') RPC
  const { data: isEntitled } = await supabase.rpc("can_perform_with_plan", {
    p_perm_key: "branding:customize"
  })

  // 4. Fetch tenant branding settings
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, brand_logo_url, brand_primary_color, brand_secondary_color")
    .eq("id", profile.tenant_id)
    .single()

  return (
    <main className="flex-1 space-y-6 p-6 max-w-5xl mx-auto w-full">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Personnalisation de la Marque (White-Labeling)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Personnalisez le logo et les couleurs de votre espace de travail pour refléter l'identité visuelle de votre cabinet.
          </p>
        </div>

        {!isEntitled ? (
          /* Non-Entitled Plan Upgrade Notice Card */
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-8 shadow-sm text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <Lock className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-foreground">
                Fonctionnalité Réservée aux Forfaits Pro & Enterprise
              </h2>
              <p className="text-sm text-muted-foreground max-w-lg mx-auto">
                La personnalisation de la marque (logo, couleurs personnalisées) nécessite un forfait supérieur. Veuillez contacter l'administrateur pour mettre à niveau votre abonnement.
              </p>
            </div>
            <Button variant="default" className="gap-2 mt-2">
              <ArrowUpRight className="h-4 w-4" />
              Découvrir les Forfaits Pro & Enterprise
            </Button>
          </div>
        ) : (
          /* Entitled Branding Form */
          <BrandingForm
            tenantId={profile.tenant_id}
            initialLogoUrl={tenant?.brand_logo_url || null}
            initialPrimaryColor={tenant?.brand_primary_color || null}
            initialSecondaryColor={tenant?.brand_secondary_color || null}
          />
        )}
      </main>
  )
}
