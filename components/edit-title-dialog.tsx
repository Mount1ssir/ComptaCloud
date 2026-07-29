"use client"

import { useState, useTransition } from "react"
import { updateTeamMemberTitleAction } from "@/app/dashboard/actions"
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
import { Input } from "@/components/ui/input"
import { Pencil, Loader2 } from "lucide-react"

interface EditTitleDialogProps {
  userId: string
  userEmail: string
  currentTitle: string | null
}

export function EditTitleDialog({ userId, userEmail, currentTitle }: EditTitleDialogProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(currentTitle || "")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const res = await updateTeamMemberTitleAction(userId, title)
      if (res.success) {
        setOpen(false)
        setError(null)
      } else {
        setError(res.error || "Une erreur est survenue lors de la mise à jour.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
            <Pencil className="h-3.5 w-3.5" />
            <span className="sr-only">Modifier le titre</span>
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Modifier le titre / poste</DialogTitle>
            <DialogDescription>
              Définissez un titre d'affichage pour {userEmail} (ex: "Comptable Senior", "Auditeur").
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive font-medium">
                {error}
              </div>
            )}

            <div className="grid gap-2">
              <label htmlFor="title-input" className="text-sm font-medium">
                Titre / Intitulé du poste
              </label>
              <Input
                id="title-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ex: Comptable Principal"
                disabled={isPending}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
