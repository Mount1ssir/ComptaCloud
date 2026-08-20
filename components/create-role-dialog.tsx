"use client"

import { useState, useTransition } from "react"
import { createRoleAction } from "@/app/super-admin/roles-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { PlusCircle, Loader2, AlertCircle } from "lucide-react"

export function CreateRoleDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError("Le nom du rôle est requis.")
      return
    }

    startTransition(async () => {
      const result = await createRoleAction(name)

      if (!result.success) {
        setError(result.error || "Échec de la création du rôle.")
      } else {
        setName("")
        setOpen(false)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button className="flex items-center gap-2">
          <PlusCircle className="h-4 w-4" />
          <span>Créer un rôle sur mesure</span>
        </Button>
      } />

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Créer un nouveau rôle</DialogTitle>
          <DialogDescription>
            Créez un rôle personnalisé. Vous pourrez ensuite lui attribuer des permissions spécifiques.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="role-name" className="text-sm font-medium">
              Nom du rôle (identifiant unique)
            </label>
            <Input
              id="role-name"
              type="text"
              placeholder="ex: auditeur_externe, manager_paie"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              Les espaces seront automatiquement convertis en tirets bas (_).
            </p>
          </div>

          <DialogFooter className="pt-2">
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
              Créer le rôle
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
