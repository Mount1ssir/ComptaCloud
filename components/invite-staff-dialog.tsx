"use client"

import { useState, useTransition } from "react"
import { inviteStaffAction } from "@/app/dashboard/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { UserPlus, Loader2 } from "lucide-react"

export function InviteStaffDialog() {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [role, setRole] = useState<string>("accountant")
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(formData: FormData) {
    setError(null)
    formData.set("role", role)

    startTransition(async () => {
      const res = await inviteStaffAction(formData)
      if (res.success) {
        setOpen(false)
        setError(null)
      } else {
        setError(res.error || "Une erreur est survenue.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="gap-2">
            <UserPlus className="h-4 w-4" />
            Inviter un membre
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[425px]">
        <form action={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Inviter un membre de l'équipe</DialogTitle>
            <DialogDescription>
              Un e-mail d'invitation sera envoyé. L'utilisateur pourra configurer son mot de passe pour accéder au cabinet.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive font-medium">
                {error}
              </div>
            )}

            <div className="grid gap-2">
              <label htmlFor="email" className="text-sm font-medium">
                Adresse e-mail
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="collegue@cabinet.com"
                required
                disabled={isPending}
              />
            </div>

            <div className="grid gap-2">
              <label htmlFor="role" className="text-sm font-medium">
                Rôle
              </label>
              <Select value={role} onValueChange={(val: any) => val && setRole(val)} disabled={isPending}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez un rôle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="accountant">Comptable (Accountant)</SelectItem>
                  <SelectItem value="cabinet_admin">Administrateur Cabinet (Cabinet Admin)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Envoyer l'invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
