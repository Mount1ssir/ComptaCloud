"use client"

import { useState, useTransition } from "react"
import { deletePlanAction } from "@/app/super-admin/plans-actions"
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
import { Trash2, Loader2, AlertCircle, AlertTriangle } from "lucide-react"

interface DeletePlanDialogProps {
  plan: {
    id: string
    name: string
    slug: string
  }
  subscriberCount: number
}

export function DeletePlanDialog({ plan, subscriberCount }: DeletePlanDialogProps) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const isBlocked = subscriberCount > 0

  function handleDelete() {
    setError(null)
    startTransition(async () => {
      const res = await deletePlanAction(plan.id)
      if (!res.success) {
        setError(res.error || "Échec de la suppression du forfait.")
      } else {
        setOpen(false)
      }
    })
  }

  if (isBlocked) {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled
        className="text-muted-foreground opacity-50 cursor-not-allowed h-8 w-8 p-0"
        title={`Impossible de supprimer: ${subscriberCount} abonnement(s) y sont associés`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0">
          <Trash2 className="h-4 w-4" />
        </Button>
      } />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive text-lg">
            <AlertTriangle className="h-5 w-5" />
            Supprimer le forfait {plan.name}
          </DialogTitle>
          <DialogDescription>
            Êtes-vous sûr de vouloir supprimer définitivement le forfait <strong className="font-semibold text-foreground">{plan.name}</strong> (<code className="font-mono text-xs">{plan.slug}</code>) ?
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg bg-destructive/15 p-3 text-sm font-medium text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <p className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
          Cette action supprimera également les quotas et permissions associés à ce forfait.
        </p>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Annuler
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Supprimer le forfait
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
