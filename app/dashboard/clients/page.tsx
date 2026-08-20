import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { CreateClientDialog } from "@/components/create-client-dialog"
import { UploadDocumentDialog } from "@/components/upload-document-dialog"
import { InviteClientButton } from "@/components/invite-client-button"
import { Building2, User, Folder, ExternalLink, Users, AlertTriangle, CheckCircle2, FileText } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export default async function ClientsPage() {
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

  if (!profile?.tenant_id) {
    redirect("/dashboard")
  }

  // 3. Fetch clients for caller's tenant
  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .eq("tenant_id", profile.tenant_id)
    .order("created_at", { ascending: false })

  // 4. Fetch documents for caller's tenant (joined with clients & uploader users)
  const { data: documents } = await supabase
    .from("documents")
    .select("id, file_name, category, drive_web_view_link, created_at, client_id, uploaded_by, clients(name), users:uploaded_by(email)")
    .eq("tenant_id", profile.tenant_id)
    .order("created_at", { ascending: false })

  // 5. Fetch plan limit quota via check_plan_limit RPC
  const { data: quotaRes } = await supabase.rpc("check_plan_limit", {
    p_limit_key: "max_clients"
  })

  const currentActiveCount = quotaRes?.current_count ?? (clients?.filter(c => c.status === "active").length || 0)
  const maxAllowed = quotaRes?.max_allowed ?? -1
  const isLimitReached = quotaRes?.allowed === false

  const categoryLabels: Record<string, string> = {
    charges: "Charges",
    salaires: "Salaires",
    comptes: "Comptes",
    contrats: "Contrats",
    documents_generaux: "Documents Généraux"
  }

  return (
    <main className="flex-1 space-y-6 p-6 max-w-7xl mx-auto w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Gestion des Clients du Cabinet
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez votre portefeuille clients et téléversez des documents comptables directement dans Google Drive.
          </p>
        </div>

        <CreateClientDialog />
      </div>

      {/* Quota Warning / Banner */}
      {maxAllowed !== -1 && (
        <div className={`rounded-xl border p-4 shadow-xs flex items-center justify-between gap-4 ${
          isLimitReached ? "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200" : "border-border bg-card"
        }`}>
          <div className="flex items-center gap-3">
            {isLimitReached ? (
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
            )}
            <div>
              <p className="text-sm font-semibold">
                Quota Clients du Forfait: <span className="font-mono">{currentActiveCount} / {maxAllowed}</span> clients actifs utilisés
              </p>
              {isLimitReached && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Vous avez atteint la limite de votre forfait. Pour ajouter d'autres clients, mettez à niveau votre abonnement.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Clients Table Card */}
      <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">
            Liste des Clients ({clients?.length || 0})
          </h2>
        </div>

        {!clients || clients.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Aucun client enregistré</h3>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-6 py-3 font-semibold">Nom / Raison Sociale</th>
                  <th className="px-6 py-3 font-semibold">Type</th>
                  <th className="px-6 py-3 font-semibold">Contact</th>
                  <th className="px-6 py-3 font-semibold">Statut</th>
                  <th className="px-6 py-3 font-semibold">Arborescence Drive</th>
                  <th className="px-6 py-3 font-semibold text-right">Actions GED</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {clients.map((client) => {
                  const driveObj = (client.drive_folders || {}) as any
                  const rootFolder = driveObj.root

                  return (
                    <tr key={client.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          {client.client_type === "company" ? (
                            <Building2 className="h-4 w-4 text-primary shrink-0" />
                          ) : (
                            <User className="h-4 w-4 text-emerald-500 shrink-0" />
                          )}
                          <span className="font-semibold">{client.name}</span>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-xs text-muted-foreground">
                        {client.client_type === "company" ? "Société" : "Particulier"}
                      </td>

                      <td className="px-6 py-4 text-xs space-y-0.5">
                        {client.email && <div className="text-foreground">{client.email}</div>}
                        {client.phone && <div className="text-muted-foreground font-mono">{client.phone}</div>}
                        {!client.email && !client.phone && <span className="text-muted-foreground italic">Aucun</span>}
                      </td>

                      <td className="px-6 py-4">
                        {client.status === "active" ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                            Actif
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-muted text-muted-foreground">
                            Archivé
                          </Badge>
                        )}
                      </td>

                      <td className="px-6 py-4 text-xs">
                        {rootFolder?.id ? (
                          <a
                            href={`https://drive.google.com/drive/folders/${rootFolder.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                          >
                            <Folder className="h-3.5 w-3.5" />
                            <span>Ouvrir sur Drive</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground italic">Non connecté</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <InviteClientButton
                            clientId={client.id}
                            clientEmail={client.email}
                            hasAuthUser={!!client.auth_user_id}
                          />
                          {rootFolder?.id ? (
                            <UploadDocumentDialog clientId={client.id} clientName={client.name} />
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Non disponible</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slice 3: Documents Récents du Cabinet Card */}
      <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Documents Récents (GED) ({documents?.length || 0})
          </h2>
        </div>

        {!documents || documents.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <FileText className="h-5 w-5" />
            </div>
            <p className="text-xs text-muted-foreground">
              Aucun document téléversé pour le moment. Utilisez le bouton "Téléverser" sur la ligne d'un client pour classer des fichiers dans Google Drive.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-6 py-3 font-semibold">Nom du Fichier</th>
                  <th className="px-6 py-3 font-semibold">Client</th>
                  <th className="px-6 py-3 font-semibold">Catégorie Drive</th>
                  <th className="px-6 py-3 font-semibold">Téléversé par</th>
                  <th className="px-6 py-3 font-semibold">Date d'Ajout</th>
                  <th className="px-6 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {documents.map((doc) => {
                  const clientData = doc.clients as any
                  const clientName = Array.isArray(clientData)
                    ? clientData[0]?.name
                    : clientData?.name || "Client"

                  const uploaderData = doc.users as any
                  const uploaderEmail = Array.isArray(uploaderData)
                    ? uploaderData[0]?.email
                    : uploaderData?.email || null

                  return (
                    <tr key={doc.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary shrink-0" />
                          <span className="font-semibold">{doc.file_name}</span>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-xs font-medium text-foreground">
                        {clientName}
                      </td>

                      <td className="px-6 py-4 text-xs">
                        <Badge variant="secondary" className="font-normal">
                          {categoryLabels[doc.category] || doc.category}
                        </Badge>
                      </td>

                      <td className="px-6 py-4 text-xs text-muted-foreground font-mono">
                        {uploaderEmail || "Système"}
                      </td>

                      <td className="px-6 py-4 text-xs text-muted-foreground font-mono">
                        {new Date(doc.created_at).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </td>

                      <td className="px-6 py-4 text-xs text-right">
                        <a
                          href={doc.drive_web_view_link}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                        >
                          <span>Voir sur Drive</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
