"use client"

import { useState, useTransition } from "react"
import { deleteRoleAction } from "@/app/super-admin/roles-actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Trash2, Loader2, AlertCircle } from "lucide-react"

interface DeleteRoleDialogProps {
  role: {
    id: string
    name: string
    is_system: boolean
  }
}

export function DeleteRoleDialog({ role }: DeleteRoleDialogProps) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (role.is_system) {
    return (
      <Button variant="ghost" size="icon" disabled title="Impossible de supprimer un rôle système">
        <Trash2 className="h-4 w-4 text-muted-foreground/40" />
      </Button>
    )
  }

  async function handleDelete() {
    setError(null)

    startTransition(async () => {
      const result = await deleteRoleAction(role.id)

      if (!result.success) {
        setError(result.error || "Échec de la suppression du rôle.")
      } else {
        setOpen(false)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10">
          <Trash2 className="h-4 w-4" />
        </Button>
      } />

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmer la suppression</DialogTitle>
          <DialogDescription>
            Êtes-vous sûr de vouloir supprimer le rôle sur mesure{" "}
            <strong className="font-mono text-foreground">{role.name}</strong> ? Cette action est irréversible.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive font-medium flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Annuler
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Supprimer le rôle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
