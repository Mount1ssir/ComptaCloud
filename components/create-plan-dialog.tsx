"use client"

import { useState, useTransition } from "react"
import { createPlanAction } from "@/app/super-admin/plans-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Plus, Loader2, AlertCircle, Package } from "lucide-react"

interface PermissionItem {
  id: string
  key: string
  label: string
  category: string
}

interface CreatePlanDialogProps {
  planPermissionsCatalog: PermissionItem[]
}

export function CreatePlanDialog({ planPermissionsCatalog }: CreatePlanDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")
  const [priceMonthly, setPriceMonthly] = useState<number>(29)
  const [currency, setCurrency] = useState("MAD")
  const [tierRank, setTierRank] = useState<number>(25)
  const [isActive, setIsActive] = useState(true)
  const [isRecommended, setIsRecommended] = useState(false)
  const [maxAccountants, setMaxAccountants] = useState<number>(5)
  const [selectedPermKeys, setSelectedPermKeys] = useState<string[]>(["drive:connect", "drive:disconnect"])

  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleNameChange(val: string) {
    setName(val)
    if (!slug || slug === name.toLowerCase().replace(/[^a-z0-9]/g, "-")) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9]/g, "-"))
    }
  }

  function handleTogglePerm(key: string) {
    setSelectedPermKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const res = await createPlanAction({
        name,
        slug,
        description,
        price_monthly: Number(priceMonthly),
        currency,
        tier_rank: Number(tierRank),
        is_active: isActive,
        is_recommended: isRecommended,
        permission_keys: selectedPermKeys,
        max_accountants: Number(maxAccountants),
        max_storage_gb: -1
      })

      if (!res.success) {
        setError(res.error || "Échec de la création du forfait.")
      } else {
        setOpen(false)
        setName("")
        setSlug("")
        setDescription("")
        setPriceMonthly(29)
        setTierRank(25)
        setIsRecommended(false)
        setSelectedPermKeys(["drive:connect", "drive:disconnect"])
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          <span>Nouveau forfait</span>
        </Button>
      } />
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Package className="h-5 w-5 text-primary" />
            Créer un nouveau forfait
          </DialogTitle>
          <DialogDescription>
            Définissez le nom, le tarif, les quotas d'utilisateurs et les fonctionnalités incluses dans cette offre.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          {error && (
            <div className="rounded-lg bg-destructive/15 p-3 text-sm font-medium text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Core Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="create-name" className="text-xs font-semibold text-foreground">
                Nom du forfait *
              </label>
              <Input
                id="create-name"
                value={name}
                onChange={e => handleNameChange(e.target.value)}
                placeholder="ex: Business Pro"
                required
                disabled={isPending}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="create-slug" className="text-xs font-semibold text-foreground">
                Slug identifiant *
              </label>
              <Input
                id="create-slug"
                value={slug}
                onChange={e => setSlug(e.target.value.toLowerCase())}
                placeholder="ex: business-pro"
                required
                disabled={isPending}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="create-desc" className="text-xs font-semibold text-foreground">
              Description
            </label>
            <Textarea
              id="create-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Courte description de la valeur apportée aux cabinets..."
              rows={2}
              disabled={isPending}
            />
          </div>

          {/* Pricing & Tier Rank */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="create-price" className="text-xs font-semibold text-foreground">
                Prix mensuel (MAD) *
              </label>
              <Input
                id="create-price"
                type="number"
                min={0}
                step="0.01"
                value={priceMonthly}
                onChange={e => setPriceMonthly(parseFloat(e.target.value) || 0)}
                required
                disabled={isPending}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="create-rank" className="text-xs font-semibold text-foreground">
                Rang hiérarchique *
              </label>
              <Input
                id="create-rank"
                type="number"
                value={tierRank}
                onChange={e => setTierRank(parseInt(e.target.value, 10) || 0)}
                placeholder="ex: 25"
                required
                disabled={isPending}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground block">
                Statut initial
              </label>
              <div className="flex items-center gap-2 h-10">
                <Switch checked={isActive} onCheckedChange={setIsActive} disabled={isPending} />
                <span className="text-xs font-medium">{isActive ? "Actif" : "Inactif"}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              id="create-recommended"
              checked={isRecommended}
              onCheckedChange={(val) => setIsRecommended(!!val)}
              disabled={isPending}
            />
            <label htmlFor="create-recommended" className="text-xs font-semibold text-foreground cursor-pointer">
              Marquer comme recommandé (Badge Recommandé)
            </label>
          </div>

          {/* Quotas & Limits */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Quotas & Limites d'Équipe
            </h4>
            <div>
              <div className="space-y-1.5">
                <label htmlFor="create-limit-acc" className="text-xs font-semibold text-foreground">
                  Membres d'équipe max (-1 = illimité)
                </label>
                <Input
                  id="create-limit-acc"
                  type="number"
                  value={maxAccountants}
                  onChange={e => setMaxAccountants(parseInt(e.target.value, 10))}
                  required
                  disabled={isPending}
                />
              </div>
            </div>
          </div>

          {/* Permissions Scope Plan */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Fonctionnalités incluses (Scope Plan)
            </h4>
            <div className="space-y-2">
              {planPermissionsCatalog.map(perm => {
                const checked = selectedPermKeys.includes(perm.key)
                return (
                  <div key={perm.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`perm-${perm.key}`}
                      checked={checked}
                      onCheckedChange={() => handleTogglePerm(perm.key)}
                      disabled={isPending}
                    />
                    <label htmlFor={`perm-${perm.key}`} className="text-xs font-medium leading-none cursor-pointer">
                      {perm.label} <code className="text-[11px] text-muted-foreground font-mono">({perm.key})</code>
                    </label>
                  </div>
                )
              })}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Annuler
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Créer le forfait
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
