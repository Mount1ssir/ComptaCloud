import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard-header"
import { SuperAdminNav } from "@/components/super-admin-nav"
import { CreatePlanDialog } from "@/components/create-plan-dialog"
import { EditPlanDialog } from "@/components/edit-plan-dialog"
import { DeletePlanDialog } from "@/components/delete-plan-dialog"
import { Badge } from "@/components/ui/badge"
import { Package, Check, Users, HardDrive, Shield, Sparkles, Building } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function SuperAdminPlansPage() {
  const supabase = await createClient()

  // 1. Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect("/")
  }

  // 2. Verify platform management role
  const { data: isPlatformRole, error: roleErr } = await supabase.rpc("is_platform_role")
  if (roleErr || !isPlatformRole) {
    redirect("/dashboard")
  }

  // 3. Query all plans ordered by tier_rank ASC
  const { data: plans } = await supabase
    .from("plans")
    .select("id, name, slug, description, price_monthly, currency, tier_rank, is_active, created_at")
    .order("tier_rank", { ascending: true })

  // 4. Query scope = 'plan' permissions catalog
  const { data: planPermissionsCatalog } = await supabase
    .from("permissions")
    .select("id, key, label, category")
    .eq("scope", "plan")
    .order("key", { ascending: true })

  // 5. Query all plan_permissions links
  const { data: planPermLinks } = await supabase
    .from("plan_permissions")
    .select("plan_id, permission_id, permissions(key)")

  // Map plan_id -> array of permission keys
  const planPermKeysMap = new Map<string, string[]>()
  if (planPermLinks) {
    planPermLinks.forEach((link: any) => {
      const key = link.permissions?.key
      if (key) {
        const current = planPermKeysMap.get(link.plan_id) || []
        current.push(key)
        planPermKeysMap.set(link.plan_id, current)
      }
    })
  }

  // 6. Query all plan_limits records
  const { data: planLimitsRows } = await supabase
    .from("plan_limits")
    .select("plan_id, limit_key, limit_value")

  // Map plan_id -> limits object
  const planLimitsMap = new Map<string, { max_accountants: number; max_storage_gb: number }>()
  if (planLimitsRows) {
    planLimitsRows.forEach((row) => {
      const current = planLimitsMap.get(row.plan_id) || { max_accountants: -1, max_storage_gb: -1 }
      if (row.limit_key === "max_accountants") current.max_accountants = row.limit_value
      if (row.limit_key === "max_storage_gb") current.max_storage_gb = row.limit_value
      planLimitsMap.set(row.plan_id, current)
    })
  }

  // 7. Query active subscriptions count grouped by plan_id
  const { data: activeSubs } = await supabase
    .from("subscriptions")
    .select("plan_id, status")
    .eq("status", "active")

  const activeSubCountMap = new Map<string, number>()
  if (activeSubs) {
    activeSubs.forEach((sub) => {
      if (sub.plan_id) {
        const current = activeSubCountMap.get(sub.plan_id) || 0
        activeSubCountMap.set(sub.plan_id, current + 1)
      }
    })
  }

  const allPlansList = plans || []
  const catalogList = planPermissionsCatalog || []

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <DashboardHeader />
      <SuperAdminNav />

      <main className="flex-1 space-y-6 p-6 max-w-7xl mx-auto w-full">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Package className="h-6 w-6 text-primary" />
              Catalogue des Forfaits & Tarifs
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gérez le catalogue des offres SaaS, les tarifs mensuels, les quotas d'utilisateurs et les accès BYOS.
            </p>
          </div>

          <CreatePlanDialog planPermissionsCatalog={catalogList} />
        </div>

        {/* Tiered Plan Tiles (ReUI Solution Billing 2 Grid) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {allPlansList.map((plan) => {
            const assignedKeys = planPermKeysMap.get(plan.id) || []
            const limits = planLimitsMap.get(plan.id) || { max_accountants: -1, max_storage_gb: -1 }
            const subscriberCount = activeSubCountMap.get(plan.id) || 0

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col justify-between rounded-xl border bg-card p-5 shadow-xs transition-all ${
                  plan.slug === "pro"
                    ? "border-primary/50 ring-1 ring-primary/20 shadow-sm"
                    : "border-border"
                }`}
              >
                {/* Popular Tag for Pro Plan */}
                {plan.slug === "pro" && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground shadow-xs flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Recommandé
                  </div>
                )}

                <div>
                  {/* Card Top Info */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-bold tracking-tight text-foreground">{plan.name}</h3>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">slug: {plan.slug}</p>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {plan.is_active ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-sans text-[11px]">
                          Actif
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="font-sans text-[11px]">
                          Archivé
                        </Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground font-mono">Rang {plan.tier_rank}</span>
                    </div>
                  </div>

                  {/* Pricing */}
                  <div className="mt-4 mb-3 flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold tracking-tight text-foreground">
                      {plan.price_monthly} {plan.currency || "MAD"}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">/ mois</span>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-muted-foreground min-h-[36px] line-clamp-2">
                    {plan.description || "Aucune description renseignée pour ce forfait."}
                  </p>

                  {/* Quotas & Limits Section */}
                  <div className="my-4 rounded-lg bg-muted/40 p-3 space-y-2 text-xs border border-border/50">
                    <div className="flex items-center justify-between font-medium">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Users className="h-3.5 w-3.5 text-primary" />
                        Comptables :
                      </span>
                      <span className="font-semibold text-foreground">
                        {limits.max_accountants === -1 ? "Illimité" : `${limits.max_accountants} max`}
                      </span>
                    </div>

                    <div className="flex items-center justify-between font-medium">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <HardDrive className="h-3.5 w-3.5 text-primary" />
                        Stockage :
                      </span>
                      <span className="font-semibold text-foreground">
                        {limits.max_storage_gb === -1 ? "Illimité" : `${limits.max_storage_gb} GB`}
                      </span>
                    </div>
                  </div>

                  {/* Feature Entitlements (Scope Plan) */}
                  <div className="space-y-2 mb-6">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                      Fonctionnalités :
                    </span>

                    <ul className="space-y-1.5 text-xs">
                      <li className="flex items-center gap-2">
                        <Check className={`h-3.5 w-3.5 ${assignedKeys.includes("drive:connect") ? "text-emerald-500 font-bold" : "text-muted/40"}`} />
                        <span className={assignedKeys.includes("drive:connect") ? "text-foreground font-medium" : "text-muted-foreground/60 line-through"}>
                          Google Drive BYOS
                        </span>
                      </li>

                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-500 font-bold" />
                        <span className="text-foreground font-medium">Export & Rapports PDF</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="pt-4 border-t border-border flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Building className="h-3.5 w-3.5" />
                    <span>{subscriberCount} cabinet(s)</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <EditPlanDialog
                      plan={plan}
                      assignedPermissionKeys={assignedKeys}
                      assignedLimits={limits}
                      planPermissionsCatalog={catalogList}
                      activeSubscribersCount={subscriberCount}
                    />
                    <DeletePlanDialog
                      plan={plan}
                      subscriberCount={subscriberCount}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
