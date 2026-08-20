"use client"

import { useState, useTransition } from "react"
import { createClientAction } from "@/app/dashboard/clients/actions"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Loader2, AlertCircle, Building2, User } from "lucide-react"

export function CreateClientDialog() {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clientType, setClientType] = useState<string>("company")
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    formData.set("clientType", clientType)

    startTransition(async () => {
      const res = await createClientAction(formData)
      if (res.success) {
        setOpen(false)
      } else {
        setError(res.error || "Une erreur est survenue lors de la création du client.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Nouveau Client
        </Button>
      } />
      <DialogContent className="sm:max-w-[485px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Ajouter un Nouveau Client</DialogTitle>
            <DialogDescription>
              Créez la fiche client. Si Google Drive est connecté, les dossiers de gestion (Charges, Salaires, Comptes, Contrats, Documents) seront automatiquement créés.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-xs text-destructive font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid gap-2">
              <label htmlFor="name" className="text-xs font-semibold text-foreground">Raison Sociale / Nom du Client *</label>
              <Input
                id="name"
                name="name"
                placeholder="ex. Alpha Finance SARL"
                required
                disabled={isPending}
              />
            </div>

            <div className="grid gap-2">
              <label htmlFor="clientType" className="text-xs font-semibold text-foreground">Type de Client</label>
              <Select value={clientType} onValueChange={(val) => setClientType(val || "company")} disabled={isPending}>
                <SelectTrigger id="clientType" className="w-full">
                  <SelectValue placeholder="Sélectionnez le type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="company">
                    <span className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      Société (Personne Morale)
                    </span>
                  </SelectItem>
                  <SelectItem value="individual">
                    <span className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      Particulier (Personne Physique)
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label htmlFor="email" className="text-xs font-semibold text-foreground">Adresse Email</label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="contact@client.com"
                  disabled={isPending}
                />
              </div>

              <div className="grid gap-2">
                <label htmlFor="phone" className="text-xs font-semibold text-foreground">Téléphone</label>
                <Input
                  id="phone"
                  name="phone"
                  placeholder="+212 600 000 000"
                  disabled={isPending}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Annuler
            </Button>
            <Button type="submit" disabled={isPending} className="gap-2">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Créer le Client
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
