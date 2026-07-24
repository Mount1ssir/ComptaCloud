import { createClient } from "@/lib/supabase/server"
import { DashboardHeader } from "@/components/dashboard-header"
import { SuperAdminNav } from "@/components/super-admin-nav"
import { ShieldCheck, Server, Users, Building2, CreditCard, Activity } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function SuperAdminPage() {
  const supabase = await createClient()

  // Aggregate SQL Count Queries
  const [
    { count: totalTenants },
    { count: activeTenants },
    { count: suspendedTenants },
    { count: totalSubscriptions },
    { count: trialSubscriptions },
    { count: activeSubscriptions },
    { count: suspendedSubscriptions },
    { count: totalLogs },
  ] = await Promise.all([
    supabase.from("tenants").select("*", { count: "exact", head: true }),
    supabase.from("tenants").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("tenants").select("*", { count: "exact", head: true }).eq("status", "suspended"),
    supabase.from("subscriptions").select("*", { count: "exact", head: true }),
    supabase.from("subscriptions").select("*", { count: "exact", head: true }).eq("status", "trial"),
    supabase.from("subscriptions").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("subscriptions").select("*", { count: "exact", head: true }).eq("status", "suspended"),
    supabase.from("logs").select("*", { count: "exact", head: true }),
  ])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <DashboardHeader />
      <SuperAdminNav />

      <main className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Context Banner */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-foreground text-sm">
              Espace Super Admin (Plateforme globale)
            </p>
            <p className="text-muted-foreground text-xs">
              Vous êtes connecté dans l'espace d'administration globale de la plateforme SaaS. Cet espace vous permet de gérer l'ensemble des cabinets (tenants), souscriptions, utilisateurs et journaux d'audit.
            </p>
          </div>
        </div>

        {/* Real Aggregate Monitoring Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Tenants Card */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Cabinets (Tenants)</span>
              <Building2 className="h-4 w-4" />
            </div>
            <div className="text-3xl font-bold text-foreground">{totalTenants || 0}</div>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                {activeTenants || 0} actifs
              </span>
              <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium">
                {suspendedTenants || 0} suspendus
              </span>
            </div>
          </div>

          {/* Subscriptions Card */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Abonnements</span>
              <CreditCard className="h-4 w-4" />
            </div>
            <div className="text-3xl font-bold text-foreground">{totalSubscriptions || 0}</div>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
                {trialSubscriptions || 0} essai (trial)
              </span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                {activeSubscriptions || 0} actifs
              </span>
              <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium">
                {suspendedSubscriptions || 0} suspendus
              </span>
            </div>
          </div>

          {/* Activity Logs Card */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Activité & Audit</span>
              <Activity className="h-4 w-4" />
            </div>
            <div className="text-3xl font-bold text-foreground">{totalLogs || 0}</div>
            <p className="text-xs text-muted-foreground">
              Évènement(s) enregistrés dans les journaux d'audit
            </p>
          </div>
        </div>

        {/* Main Console Welcome Box */}
        <div className="w-full h-[280px] border-2 border-dashed border-border bg-muted/30 rounded-xl flex flex-col items-center justify-center p-8 text-center space-y-3">
          <ShieldCheck className="h-10 w-10 text-muted-foreground/60" />
          <p className="text-foreground font-medium text-lg">
            Console de Super-Administration
          </p>
          <p className="text-muted-foreground text-sm max-w-md">
            Utilisez les onglets ci-dessus pour gérer la liste des cabinets (tenants), modifier les abonnements, ou consulter l'historique complet des actions d'administration.
          </p>
        </div>
      </main>
    </div>
  )
}
