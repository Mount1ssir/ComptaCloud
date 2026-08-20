"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { dismissBrandingPromptAction } from "@/app/dashboard/settings/branding-actions"
import { Button } from "@/components/ui/button"
import { Sparkles, ArrowRight, X } from "lucide-react"

export function BrandingPromptBanner() {
  const [dismissed, setDismissed] = useState(false)
  const [isPending, startTransition] = useTransition()

  if (dismissed) return null

  function handleDismiss() {
    setDismissed(true)
    startTransition(async () => {
      await dismissBrandingPromptAction()
    })
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-primary/30 bg-primary/10 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold text-foreground">
            Bienvenue ! Personnalisez l'identité visuelle de votre cabinet
          </h3>
          <p className="text-xs text-muted-foreground max-w-2xl">
            Ajoutez votre logo officiel et définissez la palette de couleurs de votre marque pour offrir un espace de travail personnalisé.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
        <Link href="/dashboard/settings/branding">
          <Button size="sm" className="gap-1.5 text-xs font-semibold">
            <span>Personnaliser ma marque</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          disabled={isPending}
          className="text-xs text-muted-foreground hover:text-foreground gap-1"
        >
          <span>Plus tard</span>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
