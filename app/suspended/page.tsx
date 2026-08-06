"use client"

import { useRouter } from "next/navigation"
import { AlertTriangle, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

export default function SuspendedCabinetPage() {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push("/")
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-destructive/30 bg-card p-8 shadow-xl text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-8 w-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Cabinet suspendu
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Votre cabinet a été suspendu par l'administration de la plateforme. Vous ne pouvez pas accéder à l'espace de travail pour le moment.
          </p>
        </div>

        <div className="rounded-lg bg-muted p-4 text-xs text-muted-foreground">
          Veuillez contacter le support ou l'administrateur de votre plateforme pour rétablir l'accès à votre cabinet.
        </div>

        <Button onClick={handleLogout} variant="outline" className="w-full gap-2 text-sm font-medium">
          <LogOut className="h-4 w-4" />
          Se déconnecter / Retour à l'accueil
        </Button>
      </div>
    </div>
  )
}
