import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard-header"
import { DisconnectDriveDialog } from "@/components/disconnect-drive-dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { HardDrive, CheckCircle2, AlertTriangle, ExternalLink, ShieldAlert } from "lucide-react"
import Link from "next/link"

interface StorageSettingsPageProps {
  searchParams: Promise<{ status?: string; message?: string }>
}

export default async function StorageSettingsPage({ searchParams }: StorageSettingsPageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect("/auth")
  }

  // Fetch user profile & tenant info
  // OLD CHECK: .select("role, tenant_id")
  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id, role_id, roles(name)")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile || !profile.tenant_id) {
    redirect("/dashboard")
  }

  const rolesData = profile.roles as unknown
  const roleName = Array.isArray(rolesData)
    ? (rolesData[0] as { name: string } | undefined)?.name || null
    : (rolesData as { name: string } | null)?.name || null
  const isCabinetAdmin = roleName === "cabinet_admin"

  // Fetch tenant drive connection details (RLS tenant_isolation_tenants_select isolates to user's tenant)
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, google_drive_connected, google_drive_account_email, google_drive_connected_at")
    .eq("id", profile.tenant_id)
    .single()

  const isConnected = tenant?.google_drive_connected || false

  return (
    <main className="flex-1 space-y-6 p-6 max-w-5xl mx-auto w-full">
        {/* Page Title */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <HardDrive className="h-6 w-6 text-primary" />
            Stockage Cloud (Google Drive)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connectez le compte Google Drive de votre cabinet pour l'archivage sécurisé des documents clients (BYOS).
          </p>
        </div>

        {/* Status Notification Alerts */}
        {params.status === "success" && (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4 text-emerald-600 dark:text-emerald-400 text-sm font-medium flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span>Votre compte Google Drive a été connecté avec succès !</span>
          </div>
        )}

        {params.status === "error" && (
          <div className="rounded-lg bg-destructive/15 border border-destructive/20 p-4 text-destructive text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>Erreur lors de la connexion Google Drive: {params.message || "Échec de l'autorisation"}</span>
          </div>
        )}

        {/* Non-Cabinet Admin Restriction Warning */}
        {!isCabinetAdmin && (
          <div className="rounded-xl border bg-card p-6 shadow-sm flex items-start gap-4">
            <ShieldAlert className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-semibold text-base">Accès restreint</h3>
              <p className="text-sm text-muted-foreground">
                Seuls les administrateurs de cabinet peuvent configurer ou modifier le compte de stockage Google Drive du cabinet.
              </p>
            </div>
          </div>
        )}

        {/* Storage Connection Status Card */}
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden p-6 space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${isConnected ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                <HardDrive className="h-8 w-8" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">Statut de la connexion</h2>
                  {isConnected ? (
                    <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Connecté
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1">
                      Non connecté
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Scope d'accès : <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">drive.file</code> (Fichiers créés par l'application uniquement)
                </p>
              </div>
            </div>

            {/* Connection Actions (Cabinet Admin only) */}
            {isCabinetAdmin && (
              <div>
                {isConnected ? (
                  <DisconnectDriveDialog />
                ) : (
                  <Link href="/api/drive/connect">
                    <Button className="gap-2">
                      <ExternalLink className="h-4 w-4" />
                      Connecter Google Drive
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Connected Details Grid */}
          {isConnected && (
            <div className="grid gap-4 sm:grid-cols-2 text-sm pt-2">
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Compte Google connecté</span>
                <p className="font-medium text-foreground">{tenant?.google_drive_account_email || "Compte associé"}</p>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Date de connexion</span>
                <p className="font-medium text-foreground">
                  {tenant?.google_drive_connected_at
                    ? new Date(tenant.google_drive_connected_at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })
                    : "—"}
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
  )
}
