"use client"

import * as React from "react"
import { Plus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { createTenantAction } from "../actions"

export function AddTenantDialog() {
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [subdomain, setSubdomain] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  const handleSubdomainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
    setSubdomain(val)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Client-side subdomain validation
    const subdomainRegex = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/
    if (!subdomainRegex.test(subdomain)) {
      setError("Le sous-domaine doit comporter entre 3 et 63 caractères (lettres minuscules, chiffres et tirets uniquement).")
      return;
    }

    setLoading(true)
    setError(null)

    const formData = new FormData()
    formData.append("name", name)
    formData.append("subdomain", subdomain)

    const res = await createTenantAction(null, formData)
    setLoading(false)

    if (res.success) {
      setName("")
      setSubdomain("")
      setOpen(false)
    } else {
      setError(res.error || "Une erreur s'est produite lors de la création du cabinet.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          <span>Ajouter un cabinet</span>
        </Button>
      } />
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Créer un nouveau cabinet</DialogTitle>
          <DialogDescription>
            Saisissez le nom du cabinet et son sous-domaine unique pour l'ajouter à la plateforme.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <div className="p-3 rounded-md bg-destructive/15 text-destructive text-xs font-medium border border-destructive/20">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Nom du cabinet *</label>
            <Input
              placeholder="ex: Cabinet Audit & Finance"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError(null)
              }}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Sous-domaine *</label>
            <div className="flex items-center gap-1.5">
              <Input
                placeholder="ex: audit-finance"
                value={subdomain}
                onChange={handleSubdomainChange}
                required
              />
              <span className="text-xs font-mono text-muted-foreground shrink-0">.platform.com</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Minuscules, chiffres et tirets uniquement (3 à 63 caractères).
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Créer le cabinet
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
