"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { updateTenantStatusAction, updateSubscriptionAction } from "../actions"

export interface PlanCatalogItem {
  id: string
  name: string
  slug: string
  tier_rank: number
  is_active: boolean
}

interface TenantControlsProps {
  tenant: {
    id: string
    name: string
    subdomain: string
    status: "active" | "suspended"
  }
  subscription?: {
    id: string
    plan: string
    plan_id?: string | null
    status: "active" | "trial" | "suspended"
  } | null
  plansCatalog?: PlanCatalogItem[]
}

export function TenantStatusToggle({ tenant }: { tenant: TenantControlsProps["tenant"] }) {
  const [loading, setLoading] = React.useState(false)

  const handleToggle = async () => {
    const nextStatus = tenant.status === "active" ? "suspended" : "active"
    
    // Require confirmation before suspending a tenant
    if (nextStatus === "suspended") {
      const confirmed = window.confirm(
        `Êtes-vous sûr de vouloir suspendre le cabinet "${tenant.name}" (${tenant.subdomain}) ? L'accès de ses utilisateurs sera bloqué.`
      )
      if (!confirmed) return
    }

    setLoading(true)
    await updateTenantStatusAction(tenant.id, tenant.name, nextStatus)
    setLoading(false)
  }

  return (
    <Button
      variant={tenant.status === "active" ? "destructive" : "outline"}
      size="sm"
      onClick={handleToggle}
      disabled={loading}
      className="h-8 text-xs gap-1.5"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : null}
      <span>{tenant.status === "active" ? "Suspendre" : "Activer"}</span>
    </Button>
  )
}

export function SubscriptionPlanControl({
  tenant,
  subscription,
  plansCatalog = [],
}: {
  tenant: TenantControlsProps["tenant"]
  subscription: TenantControlsProps["subscription"]
  plansCatalog?: PlanCatalogItem[]
}) {
  const [loading, setLoading] = React.useState(false)

  if (!subscription) {
    return <span className="text-xs text-muted-foreground italic">Aucune souscription</span>
  }

  const handlePlanChange = async (newPlan: string | null) => {
    if (!newPlan) return
    setLoading(true)
    await updateSubscriptionAction(
      subscription.id,
      tenant.id,
      tenant.name,
      newPlan,
      subscription.status
    )
    setLoading(false)
  }

  // Base options: only active plans
  const activePlans = plansCatalog.filter((p) => p.is_active)

  // Resolve tenant's current plan row authoritatively via plan_id FK ONLY
  const currentPlanRow = subscription.plan_id
    ? plansCatalog.find((p) => p.id === subscription.plan_id)
    : undefined

  const currentSlug = currentPlanRow?.slug || ""
  const isCurrentArchived = currentPlanRow && !currentPlanRow.is_active

  const handleStatusChange = async (newStatus: "active" | "trial" | "suspended" | null) => {
    if (!newStatus) return
    if (!currentSlug) return
    if (newStatus === "suspended") {
      const confirmed = window.confirm(
        `Êtes-vous sûr de vouloir suspendre la souscription du cabinet "${tenant.name}" ?`
      )
      if (!confirmed) return
    }

    setLoading(true)
    await updateSubscriptionAction(
      subscription.id,
      tenant.id,
      tenant.name,
      currentSlug,
      newStatus
    )
    setLoading(false)
  }

  // Fail-closed UI: If plan_id is NULL or unmapped in catalog, render warning badge + functional plan assignment dropdown
  if (!currentPlanRow || !currentSlug) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-destructive italic bg-destructive/10 px-2 py-1 rounded border border-destructive/20 shrink-0">
          Non configuré
        </span>
        <Select
          value=""
          onValueChange={handlePlanChange}
          disabled={loading}
        >
          <SelectTrigger className="h-8 w-36 text-xs border-destructive/40">
            <SelectValue placeholder="Attribuer un plan..." />
          </SelectTrigger>
          <SelectContent>
            {activePlans.map((planItem) => (
              <SelectItem key={planItem.id} value={planItem.slug}>
                {planItem.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  // Build selectable options: active plans + current tenant's archived plan ONLY
  const selectableOptions = [...activePlans]
  if (isCurrentArchived && currentPlanRow && !selectableOptions.some((p) => p.slug === currentPlanRow.slug)) {
    selectableOptions.push(currentPlanRow)
  }

  return (
    <div className="flex items-center gap-2">
      {/* Plan Selector */}
      <Select
        value={currentSlug}
        onValueChange={handlePlanChange}
        disabled={loading}
      >
        <SelectTrigger className="h-8 w-36 text-xs">
          <SelectValue placeholder="Plan" />
        </SelectTrigger>
        <SelectContent>
          {selectableOptions.map((planItem) => (
            <SelectItem key={planItem.id} value={planItem.slug}>
              {planItem.name} {!planItem.is_active ? " (Archivé)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Subscription Status Selector */}
      <Select
        value={subscription.status}
        onValueChange={handleStatusChange}
        disabled={loading}
      >
        <SelectTrigger className="h-8 w-28 text-xs">
          <SelectValue placeholder="Statut" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="trial">Trial</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="suspended">Suspended</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
