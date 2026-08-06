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
  const [isPlatformRole, setIsPlatformRole] = useState(false)
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
      const result = await createRoleAction(name, isPlatformRole)

      if (!result.success) {
        setError(result.error || "Échec de la création du rôle.")
      } else {
        setName("")
        setIsPlatformRole(false)
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
            Créez un rôle personnalisé Cabinet ou Plateforme. Vous pourrez ensuite lui attribuer des permissions spécifiques.
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
          </div>

          <div className="space-y-2">
            <label htmlFor="role-type" className="text-sm font-medium">
              Portée / Type de rôle
            </label>
            <select
              id="role-type"
              value={isPlatformRole ? "platform" : "cabinet"}
              onChange={(e) => setIsPlatformRole(e.target.value === "platform")}
              disabled={isPending}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-ring"
            >
              <option value="cabinet">Cabinet (Destiné aux membres d'équipe de cabinet)</option>
              <option value="platform">Plateforme (Super Admin / Administration Générale)</option>
            </select>
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
