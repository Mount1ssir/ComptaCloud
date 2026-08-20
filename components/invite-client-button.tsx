"use client"

import { useState, useTransition } from "react"
import { inviteClientAction } from "@/app/dashboard/clients/actions"
import { Button } from "@/components/ui/button"
import { Mail, Loader2, CheckCircle2, AlertCircle } from "lucide-react"

interface InviteClientButtonProps {
  clientId: string
  clientEmail: string | null
  hasAuthUser: boolean
}

export function InviteClientButton({ clientId, clientEmail, hasAuthUser }: InviteClientButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

  if (hasAuthUser) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Accès Porté
      </span>
    )
  }

  if (!clientEmail) {
    return (
      <span className="text-xs text-muted-foreground italic">Email manquant</span>
    )
  }

  function handleInvite() {
    setMsg(null)
    startTransition(async () => {
      const res = await inviteClientAction(clientId, clientEmail!)
      if (res.success) {
        setMsg({ type: "success", text: "Invitation envoyée !" })
      } else {
        setMsg({ type: "error", text: res.error || "Échec d'envoi" })
      }
    })
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={handleInvite}
        disabled={isPending}
        className="gap-1 text-xs h-7 px-2.5"
      >
        {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
        <span>Inviter le client</span>
      </Button>
      {msg && (
        <span className={`text-[10px] ${msg.type === "success" ? "text-emerald-600" : "text-destructive"}`}>
          {msg.text}
        </span>
      )}
    </div>
  )
}
