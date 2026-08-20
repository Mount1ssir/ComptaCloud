import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { FileText, ExternalLink, Building2, User, LogOut } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SignOutButton } from "@/components/sign-out-button"

export default async function ClientPortalPage() {
  const supabase = await createClient()

  // 1. Authenticate calling user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect("/")
  }

  // 2. Fetch user profile & client_id via get_my_client_id RPC
  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id, client_id, email, tenants(name, brand_logo_url)")
    .eq("id", user.id)
    .single()

  const { data: clientId } = await supabase.rpc("get_my_client_id")
  const resolvedClientId = clientId || profile?.client_id
  const tenantId = profile?.tenant_id

  if (!tenantId || !resolvedClientId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full rounded-xl border bg-card p-6 text-center space-y-4 shadow-xs">
          <h2 className="text-lg font-bold text-foreground">Accès Porté Non Configuré</h2>
          <p className="text-xs text-muted-foreground">
            Votre compte utilisateur n'est pas encore lié à une fiche client. Veuillez contacter votre cabinet comptable pour recevoir une invitation valide.
          </p>
          <SignOutButton />
        </div>
      </div>
    )
  }

  // 3. Fetch client details
  const { data: client } = await supabase
    .from("clients")
    .select("id, name, client_type, email, phone")
    .eq("id", resolvedClientId)
    .single()

  // 4. Fetch documents WHERE client_id = resolvedClientId (RLS strictly enforced)
  const { data: documents } = await supabase
    .from("documents")
    .select("id, file_name, category, drive_web_view_link, created_at")
    .eq("client_id", resolvedClientId)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })

  const tenantData = profile?.tenants as any
  const cabinetName = tenantData?.name || "Cabinet Comptable"
  const logoUrl = tenantData?.brand_logo_url

  const categoryLabels: Record<string, string> = {
    charges: "Charges",
    salaires: "Salaires",
    comptes: "Comptes",
    contrats: "Contrats",
    documents_generaux: "Documents Généraux"
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Portal Header */}
      <header className="sticky top-0 z-40 border-b bg-card px-6 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt={cabinetName} className="h-8 max-w-[140px] object-contain shrink-0" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
              {cabinetName.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="text-base font-bold text-foreground leading-tight">{cabinetName}</h1>
            <p className="text-xs text-muted-foreground">Portail Client Sécurisé</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5 justify-end">
              {client?.client_type === "company" ? (
                <Building2 className="h-3.5 w-3.5 text-primary" />
              ) : (
                <User className="h-3.5 w-3.5 text-emerald-500" />
              )}
              {client?.name || "Espace Client"}
            </p>
            <p className="text-[11px] text-muted-foreground font-mono">{profile.email}</p>
          </div>

          <SignOutButton />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 max-w-6xl mx-auto w-full space-y-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Vos Documents Comptables
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Consultez les documents mis à votre disposition par votre cabinet d'expertise comptable.
          </p>
        </div>

        {/* Documents Table */}
        <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
          {!documents || documents.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <FileText className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Aucun document disponible</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Votre cabinet n'a pas encore partagé de documents. Dès qu'un document est ajouté, il apparaîtra automatiquement ici.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Nom du Fichier</th>
                    <th className="px-6 py-3 font-semibold">Catégorie</th>
                    <th className="px-6 py-3 font-semibold">Date de Dépot</th>
                    <th className="px-6 py-3 font-semibold text-right">Consultation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary shrink-0" />
                          <span className="font-semibold">{doc.file_name}</span>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-xs">
                        <Badge variant="secondary" className="font-normal">
                          {categoryLabels[doc.category] || doc.category}
                        </Badge>
                      </td>

                      <td className="px-6 py-4 text-xs text-muted-foreground font-mono">
                        {new Date(doc.created_at).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric"
                        })}
                      </td>

                      <td className="px-6 py-4 text-xs text-right">
                        <a
                          href={doc.drive_web_view_link}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                        >
                          <span>Consulter</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
