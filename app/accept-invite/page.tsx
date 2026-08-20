"use client"

import { useState, useEffect, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { KeyRound, Loader2, CheckCircle2, AlertCircle, UserCheck } from "lucide-react"
import { activateTenantAction } from "./actions"

export default function AcceptInvitePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loadingSession, setLoadingSession] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [invitedEmail, setInvitedEmail] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const supabase = createClient()

  useEffect(() => {
    async function initSession() {
      try {
        setLoadingSession(true)
        setError(null)

        // Step a: Unconditionally sign out any pre-existing session to prevent session hijacking/overwrites
        await supabase.auth.signOut()

        // Step b: Parse invite tokens explicitly from URL (hash fragment or query params)
        let accessToken: string | null = null
        let refreshToken: string | null = null

        if (typeof window !== "undefined" && window.location.hash) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1))
          accessToken = hashParams.get("access_token")
          refreshToken = hashParams.get("refresh_token")
        }

        const code = searchParams.get("code")
        const tokenHash = searchParams.get("token_hash")
        const type = searchParams.get("type")

        let sessionEstablished = false

        // Step c: Explicitly establish session using ONLY parsed URL tokens
        if (accessToken && refreshToken) {
          const { error: setErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (!setErr) sessionEstablished = true
          else console.error("setSession error:", setErr)
        } else if (code) {
          const { error: codeErr } = await supabase.auth.exchangeCodeForSession(code)
          if (!codeErr) sessionEstablished = true
          else console.error("Code exchange error:", codeErr)
        } else if (tokenHash && type === "invite") {
          const { error: verifyErr } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "invite",
          })
          if (!verifyErr) sessionEstablished = true
          else console.error("OTP verify error:", verifyErr)
        }

        // Step d: Verify user and fetch the email of the target invited account
        if (sessionEstablished) {
          const { data: { user }, error: userErr } = await supabase.auth.getUser()

          if (!userErr && user && user.email) {
            setInvitedEmail(user.email)
            setHasSession(true)
            setLoadingSession(false)
            return
          }
        }

        // Step e: If session establishment failed, show error and block form
        setError("L'invitation a expiré ou le lien est invalide.")
        setHasSession(false)
        setLoadingSession(false)
      } catch (err: any) {
        console.error("Init session exception:", err)
        setError(err?.message || "Erreur lors de la vérification de l'invitation.")
        setHasSession(false)
        setLoadingSession(false)
      }
    }

    initSession()
  }, [searchParams])

  // Step f: Call updateUser only for the explicitly established session
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.")
      return
    }

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.")
      return
    }
    startTransition(async () => {
      const { error: updateErr } = await supabase.auth.updateUser({ password })

      if (updateErr) {
        setError(updateErr.message || "Impossible de mettre à jour le mot de passe.")
      } else {
        // Transition tenant status from 'pending' -> 'active' if this is an invited cabinet_admin
        const actRes = await activateTenantAction()

        if (!actRes.success && actRes.error) {
          console.error("activateTenantAction failed:", actRes.error)
          setError(actRes.error)
          return
        }

        setSuccess(true)
        setTimeout(() => {
          router.push("/")
          router.refresh()
        }, 1500)
      }
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6 rounded-xl border bg-card p-6 shadow-lg">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Accepter l'invitation</h1>
          <p className="text-sm text-muted-foreground">
            Définissez votre mot de passe pour accéder à votre espace cabinet.
          </p>
        </div>

        {loadingSession ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Vérification de l'invitation...</p>
          </div>
        ) : success ? (
          <div className="rounded-lg bg-emerald-500/10 p-4 text-center text-emerald-600 dark:text-emerald-400 space-y-2">
            <CheckCircle2 className="h-8 w-8 mx-auto" />
            <p className="font-semibold text-base">Mot de passe défini avec succès !</p>
            <p className="text-xs text-muted-foreground">Redirection vers votre tableau de bord...</p>
          </div>
        ) : error && !hasSession ? (
          <div className="rounded-lg bg-destructive/15 p-4 text-center text-destructive space-y-3">
            <AlertCircle className="h-8 w-8 mx-auto" />
            <p className="font-medium text-sm">{error}</p>
            <Button variant="outline" className="w-full mt-2" onClick={() => router.push("/auth")}>
              Retour à la page de connexion
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Step d: Display target invited email as safety check */}
            {invitedEmail && (
              <div className="rounded-md bg-muted p-3 text-xs text-foreground flex items-center gap-2 border border-border">
                <UserCheck className="h-4 w-4 text-primary shrink-0" />
                <span>
                  Configuration du mot de passe pour : <strong className="font-semibold">{invitedEmail}</strong>
                </span>
              </div>
            )}

            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Nouveau mot de passe
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirmer le mot de passe
              </label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                disabled={isPending}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer et accéder au cabinet
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
