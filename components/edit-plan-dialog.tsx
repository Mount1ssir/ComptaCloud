"use client"

import { useState, useEffect, useTransition } from "react"
import { updatePlanAction } from "@/app/super-admin/plans-actions"
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
import { Pencil, Loader2, AlertCircle, AlertTriangle } from "lucide-react"

interface PermissionItem {
  id: string
  key: string
  label: string
  category: string
}

interface EditPlanDialogProps {
  plan: {
    id: string
    name: string
    slug: string
    description?: string
    price_monthly: number
    currency?: string
    tier_rank: number
    is_active: boolean
  }
  assignedPermissionKeys: string[]
  assignedLimits: { max_accountants: number; max_storage_gb: number }
  planPermissionsCatalog: PermissionItem[]
  activeSubscribersCount: number
}

export function EditPlanDialog({
  plan,
  assignedPermissionKeys,
  assignedLimits,
  planPermissionsCatalog,
  activeSubscribersCount,
}: EditPlanDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(plan.name)
  const [slug, setSlug] = useState(plan.slug)
  const [description, setDescription] = useState(plan.description || "")
  const [priceMonthly, setPriceMonthly] = useState<number>(plan.price_monthly)
  const [currency, setCurrency] = useState(plan.currency || "MAD")
  const [tierRank, setTierRank] = useState<number>(plan.tier_rank)
  const [isActive, setIsActive] = useState(plan.is_active)
  const [maxAccountants, setMaxAccountants] = useState<number>(assignedLimits.max_accountants)
  const [maxStorageGb, setMaxStorageGb] = useState<number>(assignedLimits.max_storage_gb)
  const [selectedPermKeys, setSelectedPermKeys] = useState<string[]>(assignedPermissionKeys)

  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setName(plan.name)
    setSlug(plan.slug)
    setDescription(plan.description || "")
    setPriceMonthly(plan.price_monthly)
    setCurrency(plan.currency || "MAD")
    setTierRank(plan.tier_rank)
    setIsActive(plan.is_active)
    setMaxAccountants(assignedLimits.max_accountants)
    setMaxStorageGb(assignedLimits.max_storage_gb)
    setSelectedPermKeys(assignedPermissionKeys)
  }, [plan, assignedPermissionKeys, assignedLimits, open])

  function handleTogglePerm(key: string) {
    setSelectedPermKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const res = await updatePlanAction(plan.id, {
        id: plan.id,
        name,
        slug,
        description,
        price_monthly: Number(priceMonthly),
        currency,
        tier_rank: Number(tierRank),
        is_active: isActive,
        permission_keys: selectedPermKeys,
        max_accountants: Number(maxAccountants),
        max_storage_gb: Number(maxStorageGb)
      })

      if (!res.success) {
        setError(res.error || "Échec de la modification du forfait.")
      } else {
        setOpen(false)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="outline" size="sm" className="gap-1.5">
          <Pencil className="h-3.5 w-3.5" />
          <span>Modifier</span>
        </Button>
      } />
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Pencil className="h-5 w-5 text-primary" />
            Modifier le forfait {plan.name}
          </DialogTitle>
          <DialogDescription>
            Ajustez les tarifs, les quotas et les permissions pour cette offre.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Active Subscriber Impact Warning */}
          {activeSubscribersCount > 0 && (
            <div className="rounded-lg bg-amber-500/15 border border-amber-500/30 p-3 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                <strong>Attention :</strong> {activeSubscribersCount} cabinet(s) utilisent actuellement ce forfait. Toute modification des limites ou des permissions prendra effet <strong>immédiatement</strong> pour l'ensemble de ces cabinets.
              </span>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-destructive/15 p-3 text-sm font-medium text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Core Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor={`edit-name-${plan.id}`} className="text-xs font-semibold text-foreground">
                Nom du forfait *
              </label>
              <Input
                id={`edit-name-${plan.id}`}
                value={name}
                onChange={e => setName(e.target.value)}
                required
                disabled={isPending}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor={`edit-slug-${plan.id}`} className="text-xs font-semibold text-foreground">
                Slug identifiant *
              </label>
              <Input
                id={`edit-slug-${plan.id}`}
                value={slug}
                onChange={e => setSlug(e.target.value.toLowerCase())}
                required
                disabled={isPending}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor={`edit-desc-${plan.id}`} className="text-xs font-semibold text-foreground">
              Description
            </label>
            <Textarea
              id={`edit-desc-${plan.id}`}
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              disabled={isPending}
            />
          </div>

          {/* Pricing & Tier Rank */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label htmlFor={`edit-price-${plan.id}`} className="text-xs font-semibold text-foreground">
                Prix mensuel (MAD) *
              </label>
              <Input
                id={`edit-price-${plan.id}`}
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
              <label htmlFor={`edit-rank-${plan.id}`} className="text-xs font-semibold text-foreground">
                Rang hiérarchique *
              </label>
              <Input
                id={`edit-rank-${plan.id}`}
                type="number"
                value={tierRank}
                onChange={e => setTierRank(parseInt(e.target.value, 10) || 0)}
                required
                disabled={isPending}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground block">
                Statut
              </label>
              <div className="flex items-center gap-2 h-10">
                <Switch checked={isActive} onCheckedChange={setIsActive} disabled={isPending} />
                <span className="text-xs font-medium">{isActive ? "Actif" : "Archivé"}</span>
              </div>
            </div>
          </div>

          {/* Quotas & Limits */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Quotas & Limites de Forfait
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor={`edit-acc-${plan.id}`} className="text-xs font-semibold text-foreground">
                  Comptables max (-1 = illimité)
                </label>
                <Input
                  id={`edit-acc-${plan.id}`}
                  type="number"
                  value={maxAccountants}
                  onChange={e => setMaxAccountants(parseInt(e.target.value, 10))}
                  required
                  disabled={isPending}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor={`edit-storage-${plan.id}`} className="text-xs font-semibold text-foreground">
                  Stockage GB max (-1 = illimité)
                </label>
                <Input
                  id={`edit-storage-${plan.id}`}
                  type="number"
                  value={maxStorageGb}
                  onChange={e => setMaxStorageGb(parseInt(e.target.value, 10))}
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
                      id={`edit-perm-${plan.id}-${perm.key}`}
                      checked={checked}
                      onCheckedChange={() => handleTogglePerm(perm.key)}
                      disabled={isPending}
                    />
                    <label htmlFor={`edit-perm-${plan.id}-${perm.key}`} className="text-xs font-medium leading-none cursor-pointer">
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
              Enregistrer les modifications
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
