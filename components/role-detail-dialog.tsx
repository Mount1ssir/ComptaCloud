"use client"

import { useState, useEffect, useTransition } from "react"
import { updateRolePermissionsAction } from "@/app/super-admin/roles-actions"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { ShieldCheck, Loader2, AlertCircle, CheckCircle2, Lock } from "lucide-react"

interface PermissionItem {
  id: string
  key: string
  label: string
  category: string
}

interface RoleDetailDialogProps {
  role: {
    id: string
    name: string
    is_system: boolean
    is_platform_role: boolean
  }
  allPermissions: PermissionItem[]
  assignedPermissionIds: string[]
}

export function RoleDetailDialog({
  role,
  allPermissions,
  assignedPermissionIds,
}: RoleDetailDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>(assignedPermissionIds)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setSelectedIds(assignedPermissionIds)
  }, [assignedPermissionIds, open])

  // Group permissions by category
  const groupedPermissions = allPermissions.reduce((acc, perm) => {
    const cat = perm.category || "général"
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(perm)
    return acc
  }, {} as Record<string, PermissionItem[]>)

  const categoryLabels: Record<string, string> = {
    tenants: "Gestion des Cabinets (Tenants)",
    team: "Gestion de l'Équipe",
    storage: "Stockage Cloud & BYOS",
    subscriptions: "Abonnements",
    audit: "Audit & Journaux",
  }

  function handleToggle(permissionId: string) {
    setSelectedIds((prev) =>
      prev.includes(permissionId)
        ? prev.filter((id) => id !== permissionId)
        : [...prev, permissionId]
    )
  }

  async function handleSave() {
    setError(null)
    setSuccess(false)

    startTransition(async () => {
      const result = await updateRolePermissionsAction(role.id, selectedIds)

      if (!result.success) {
        setError(result.error || "Échec de la mise à jour des permissions.")
      } else {
        setSuccess(true)
        setTimeout(() => {
          setSuccess(false)
          setOpen(false)
        }, 1200)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="outline" size="sm" className="flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span>Gérer les permissions</span>
        </Button>
      } />

      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="text-xl">
              Permissions du rôle : <span className="font-mono text-primary">{role.name}</span>
            </DialogTitle>
            {role.is_system && (
              <Badge variant="secondary" className="gap-1">
                <Lock className="h-3 w-3" /> Rôle Système
              </Badge>
            )}
          </div>
          <DialogDescription>
            Cochez les permissions attribuées à ce rôle. Les modifications seront enregistrées immédiatement.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 py-4 space-y-6">
          {error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Permissions enregistrées avec succès !</span>
            </div>
          )}

          {Object.entries(groupedPermissions).map(([cat, perms]) => (
            <div key={cat} className="space-y-3 rounded-lg border border-border bg-card p-4">
              <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground flex items-center justify-between">
                <span>{categoryLabels[cat] || cat}</span>
                <span className="text-xs font-normal font-mono">
                  {perms.filter((p) => selectedIds.includes(p.id)).length} / {perms.length}
                </span>
              </h3>

              <div className="grid gap-2">
                {perms.map((perm) => {
                  const isChecked = selectedIds.includes(perm.id)
                  return (
                    <label
                      key={perm.id}
                      className={`flex items-start gap-3 p-2.5 rounded-md border cursor-pointer transition-colors ${
                        isChecked
                          ? "bg-primary/5 border-primary/30 text-foreground"
                          : "border-border/60 hover:bg-accent text-muted-foreground"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggle(perm.id)}
                        disabled={isPending}
                        className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-foreground">{perm.label}</span>
                          <span className="font-mono text-xs text-muted-foreground shrink-0">
                            {perm.key}
                          </span>
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="pt-3 border-t border-border">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Fermer
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enregistrer les modifications
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
