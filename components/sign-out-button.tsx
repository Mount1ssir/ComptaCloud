"use client"

import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"

export function SignOutButton() {
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleSignOut}
      className="gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
    >
      <LogOut className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Déconnexion</span>
    </Button>
  )
}
