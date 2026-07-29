"use client"

import { useState, useTransition } from "react"
import { disconnectDriveAction } from "@/app/dashboard/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { LogOut, Loader2 } from "lucide-react"

export function DisconnectDriveDialog() {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleDisconnect() {
    setError(null)
    startTransition(async () => {
      const res = await disconnectDriveAction()
      if (res.success) {
        setOpen(false)
      } else {
        setError(res.error || "Une erreur est survenue lors de la déconnexion.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="destructive" className="gap-2">
            <LogOut className="h-4 w-4" />
            Déconnecter Google Drive
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Déconnecter Google Drive</DialogTitle>
          <DialogDescription>
            Êtes-vous sûr de vouloir déconnecter le compte Google Drive de votre cabinet ? L'accès de l'application sera révoqué.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive font-medium">
            {error}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Annuler
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDisconnect}
            disabled={isPending}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmer la déconnexion
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
