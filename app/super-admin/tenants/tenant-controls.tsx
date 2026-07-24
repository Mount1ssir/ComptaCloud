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
    status: "active" | "trial" | "suspended"
  } | null
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
      variant={tenant.status === "active" ? "destructive" : "default"}
      size="sm"
      onClick={handleToggle}
      disabled={loading}
      className="h-8 text-xs font-medium"
    >
      {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
      {tenant.status === "active" ? "Suspendre" : "Activer"}
    </Button>
  )
}

export function SubscriptionPlanControl({
  tenant,
  subscription,
}: {
  tenant: TenantControlsProps["tenant"]
  subscription: TenantControlsProps["subscription"]
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

  const handleStatusChange = async (newStatus: "active" | "trial" | "suspended" | null) => {
    if (!newStatus) return
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
      subscription.plan,
      newStatus
    )
    setLoading(false)
  }

  return (
    <div className="flex items-center gap-2">
      {/* Plan Selector */}
      <Select
        value={subscription.plan}
        onValueChange={handlePlanChange}
        disabled={loading}
      >
        <SelectTrigger className="h-8 w-28 text-xs">
          <SelectValue placeholder="Plan" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="trial">Trial</SelectItem>
          <SelectItem value="starter">Starter</SelectItem>
          <SelectItem value="pro">Pro</SelectItem>
          <SelectItem value="enterprise">Enterprise</SelectItem>
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
