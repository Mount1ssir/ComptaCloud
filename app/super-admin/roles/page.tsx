import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard-header"
import { SuperAdminNav } from "@/components/super-admin-nav"
import { CreateRoleDialog } from "@/components/create-role-dialog"
import { RoleDetailDialog } from "@/components/role-detail-dialog"
import { DeleteRoleDialog } from "@/components/delete-role-dialog"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ShieldCheck, Lock, Info, KeyRound } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function SuperAdminRolesPage() {
  const supabase = await createClient()

  // Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect("/")
  }

  // Verify platform management role
  // OLD CHECK: if (!profile || profile.role !== "super_admin")
  const { data: isPlatformRole, error: roleErr } = await supabase.rpc("is_platform_role")

  if (roleErr || !isPlatformRole) {
    redirect("/dashboard")
  }

  // Query all roles
  const { data: roles, error: rolesErr } = await supabase
    .from("roles")
    .select("id, name, is_system, is_platform_role, created_at")
    .order("is_system", { ascending: false })
    .order("name", { ascending: true })

  // Query all permissions catalog
  const { data: permissions } = await supabase
    .from("permissions")
    .select("id, key, label, category")
    .order("category", { ascending: true })

  // Query all role_permissions mappings
  const { data: rolePermissions } = await supabase
    .from("role_permissions")
    .select("role_id, permission_id")

  // Map role_id -> array of permission_ids
  const rolePermMap = new Map<string, string[]>()
  if (rolePermissions) {
    rolePermissions.forEach((rp) => {
      const current = rolePermMap.get(rp.role_id) || []
      current.push(rp.permission_id)
      rolePermMap.set(rp.role_id, current)
    })
  }

  const allPermsList = permissions || []

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <DashboardHeader />
      <SuperAdminNav />

      <main className="flex-1 space-y-6 p-6 max-w-7xl mx-auto w-full">

        {/* Header & Create Role Action */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" />
              Gestion des Rôles & Permissions
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Consultez les rôles système et créez des rôles sur mesure avec leur catalogue de permissions.
            </p>
          </div>

          <CreateRoleDialog />
        </div>

        {/* Roles Table */}
        <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[200px]">Nom du rôle</TableHead>
                <TableHead className="w-[140px]">Type</TableHead>
                <TableHead className="w-[180px]">Permissions attribuées</TableHead>
                <TableHead className="w-[180px]">Date de création</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!roles || roles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Aucun rôle enregistré.
                  </TableCell>
                </TableRow>
              ) : (
                roles.map((r) => {
                  const assignedPermIds = rolePermMap.get(r.id) || []
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-semibold text-foreground font-mono">
                        {r.name}
                      </TableCell>

                      <TableCell>
                        {r.is_system ? (
                          <Badge variant="secondary" className="gap-1 font-sans">
                            <Lock className="h-3 w-3" /> Système
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 font-sans border-primary/40 text-primary">
                            Sur mesure
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline" className="gap-1 font-mono">
                          <KeyRound className="h-3 w-3 text-muted-foreground" />
                          {r.is_platform_role ? "Toutes (Plateforme)" : `${assignedPermIds.length} / ${allPermsList.length}`}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <RoleDetailDialog
                            role={r}
                            allPermissions={allPermsList}
                            assignedPermissionIds={assignedPermIds}
                          />
                          <DeleteRoleDialog role={r} />
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  )
}
