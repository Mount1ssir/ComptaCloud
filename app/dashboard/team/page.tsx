import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { redirect } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard-header"
import { InviteStaffDialog } from "@/components/invite-staff-dialog"
import { EditTitleDialog } from "@/components/edit-title-dialog"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Users, Mail, ShieldCheck, CheckCircle2, Clock } from "lucide-react"

export default async function TeamPage() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect("/auth")
  }

  // Fetch current user's profile
  // OLD CHECK: .select("role, tenant_id")
  const { data: currentUserProfile } = await supabase
    .from("users")
    .select("tenant_id, role_id, roles(name)")
    .eq("id", user.id)
    .maybeSingle()

  if (!currentUserProfile || !currentUserProfile.tenant_id) {
    redirect("/dashboard")
  }

  const curRolesData = currentUserProfile.roles as unknown
  const currentUserRoleName = Array.isArray(curRolesData)
    ? (curRolesData[0] as { name: string } | undefined)?.name || null
    : (curRolesData as { name: string } | null)?.name || null
  const isCabinetAdmin = currentUserRoleName === "cabinet_admin"

  // Fetch team members from public.users (RLS isolates to caller's tenant)
  const { data: teamMembers, error: teamError } = await supabase
    .from("users")
    .select("id, email, title, created_at, role_id, roles(name)")
    .order("created_at", { ascending: true })

  // Query auth.users server-side via admin API to resolve invite status (email_confirmed_at)
  let authUsersMap = new Map<string, { email_confirmed_at: string | null }>()
  try {
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )
    const { data: authUsersData } = await supabaseAdmin.auth.admin.listUsers()
    if (authUsersData?.users) {
      authUsersData.users.forEach((u) => {
        authUsersMap.set(u.id, { email_confirmed_at: u.email_confirmed_at || null })
      })
    }
  } catch (err) {
    console.error("Failed to query auth users status:", err)
  }

  // Query dynamic cabinet-scoped roles (is_platform_role = false)
  const { data: availableRolesData } = await supabase
    .from("roles")
    .select("id, name")
    .eq("is_platform_role", false)
    .order("name", { ascending: true })

  const availableRoles = (availableRolesData || []).map(r => ({ id: r.id, name: r.name }))

  return (
    <main className="flex-1 space-y-6 p-6 max-w-7xl mx-auto w-full">
        {/* Page Title & Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Gestion de l'équipe
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gérez les membres de votre cabinet et leurs rôles.
            </p>
          </div>

          {isCabinetAdmin && <InviteStaffDialog availableRoles={availableRoles} />}
        </div>

        {/* Team Members Table Card */}
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Titre / Poste</TableHead>
                <TableHead>Statut invitation</TableHead>
                {isCabinetAdmin && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamError ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-destructive">
                    Erreur de chargement des membres de l'équipe.
                  </TableCell>
                </TableRow>
              ) : !teamMembers || teamMembers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    Aucun membre d'équipe trouvé.
                  </TableCell>
                </TableRow>
              ) : (
                teamMembers.map((member) => {
                  const authInfo = authUsersMap.get(member.id)
                  const isAccepted = authInfo ? authInfo.email_confirmed_at !== null : true

                  return (
                    <TableRow key={member.id}>
                      {/* Email / User */}
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span>{member.email}</span>
                          {member.id === user.id && (
                            <Badge variant="outline" className="text-[10px] py-0">
                              Vous
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      {/* Role Badge */}
                      <TableCell>
                        {(() => {
                          const mRolesData = member.roles as unknown
                          const mRole = Array.isArray(mRolesData)
                            ? (mRolesData[0] as { name: string } | undefined)?.name || null
                            : (mRolesData as { name: string } | null)?.name || null
                          return mRole === "cabinet_admin" ? (
                            <Badge variant="default" className="gap-1 bg-indigo-600 hover:bg-indigo-700">
                              <ShieldCheck className="h-3 w-3" />
                              Admin Cabinet
                            </Badge>
                          ) : mRole === "accountant" ? (
                            <Badge variant="secondary" className="gap-1">
                              Comptable
                            </Badge>
                          ) : (
                            <Badge variant="outline">{mRole || "Membre"}</Badge>
                          )
                        })()}
                      </TableCell>

                      {/* Title */}
                      <TableCell>
                        {member.title ? (
                          <span className="font-medium text-foreground">{member.title}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">— Non défini —</span>
                        )}
                      </TableCell>

                      {/* Invite Status */}
                      <TableCell>
                        {isAccepted ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Accepté
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                            <Clock className="h-3.5 w-3.5 animate-pulse" />
                            En attente
                          </span>
                        )}
                      </TableCell>

                      {/* Actions */}
                      {isCabinetAdmin && (
                        <TableCell className="text-right">
                          <EditTitleDialog
                            userId={member.id}
                            userEmail={member.email}
                            currentTitle={member.title}
                          />
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </main>
  )
}
