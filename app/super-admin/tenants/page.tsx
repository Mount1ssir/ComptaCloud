import { createClient } from "@/lib/supabase/server"
import { DashboardHeader } from "@/components/dashboard-header"
import { SuperAdminNav } from "@/components/super-admin-nav"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { IconStack } from "@/components/reui/icon-stack"
import { AddTenantDialog } from "./add-tenant-dialog"
import { TenantStatusToggle, SubscriptionPlanControl } from "./tenant-controls"

export const dynamic = "force-dynamic"

export default async function TenantsPage() {
  const supabase = await createClient()

  // 1. Fetch tenants
  const { data: tenants, error: tenantsError } = await supabase
    .from("tenants")
    .select("*")
    .order("created_at", { ascending: false })

  // 2. Fetch latest subscriptions for each tenant
  const { data: subscriptions, error: subsError } = await supabase
    .from("subscriptions")
    .select("*")
    .order("created_at", { ascending: false })

  // 3. Fetch live plans catalog
  const { data: plansCatalog } = await supabase
    .from("plans")
    .select("id, name, slug, tier_rank, is_active")
    .order("tier_rank", { ascending: true })

  if (tenantsError) {
    console.error("Error fetching tenants:", tenantsError)
  }

  // Map latest subscription to each tenant
  const tenantsWithSubscriptions = (tenants || []).map((tenant) => {
    const sub = (subscriptions || []).find((s) => s.tenant_id === tenant.id)
    return {
      ...tenant,
      subscription: sub || null,
    }
  })

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <DashboardHeader />
      <SuperAdminNav />

      <main className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Top Header Row */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Gestion des Cabinets (Tenants)</h1>
            <p className="text-sm text-muted-foreground">
              Créez, gérez et supervisez les accès et abonnements de tous les cabinets comptables.
            </p>
          </div>
          <AddTenantDialog />
        </div>

        {/* Tenants Table */}
        <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
          {tenantsWithSubscriptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
              <IconStack />
              <div className="space-y-1">
                <h3 className="font-semibold text-base text-foreground">Aucun cabinet enregistré</h3>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Aucun cabinet n'a été créé pour le moment. Cliquez sur le bouton ci-dessus pour ajouter votre premier cabinet.
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Cabinet (Nom)</TableHead>
                  <TableHead>Sous-domaine</TableHead>
                  <TableHead>Statut Tenant</TableHead>
                  <TableHead>Plan Souscription</TableHead>
                  <TableHead>Statut Souscription</TableHead>
                  <TableHead>Date de création</TableHead>
                  <TableHead className="text-right">Actions / Contrôles</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenantsWithSubscriptions.map((tenant) => {
                  const sub = tenant.subscription
                  const formattedDate = new Date(tenant.created_at).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })

                  return (
                    <TableRow key={tenant.id}>
                      <TableCell className="font-semibold text-foreground">
                        {tenant.name}
                      </TableCell>

                      <TableCell>
                        <code className="text-xs font-mono px-2 py-0.5 rounded-md bg-muted border border-border">
                          {tenant.subdomain}
                        </code>
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant={tenant.status === "active" ? "default" : "destructive"}
                          className="capitalize text-[11px]"
                        >
                          {tenant.status}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        {(() => {
                          const planRow = (plansCatalog || []).find((p) => p.id === sub?.plan_id)
                          const planDisplayName = planRow
                            ? `${planRow.name}${!planRow.is_active ? " (Archivé)" : ""}`
                            : sub?.plan_id
                            ? "Plan inconnu"
                            : "Non configuré"

                          return (
                            <Badge
                              variant={planRow ? "outline" : "destructive"}
                              className="capitalize text-[11px]"
                            >
                              {planDisplayName}
                            </Badge>
                          )
                        })()}
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant={
                            sub?.status === "active"
                              ? "default"
                              : sub?.status === "trial"
                              ? "secondary"
                              : "destructive"
                          }
                          className="capitalize text-[11px]"
                        >
                          {sub?.status || "N/A"}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground">
                        {formattedDate}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-3">
                          <SubscriptionPlanControl tenant={tenant} subscription={sub} plansCatalog={plansCatalog || []} />
                          <TenantStatusToggle tenant={tenant} />
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </main>
    </div>
  )
}
