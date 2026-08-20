"use client"

import { useState, useTransition } from "react"
import { uploadDocumentAction } from "@/app/dashboard/documents/actions"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Upload, Loader2, AlertCircle, FileText, CheckCircle2 } from "lucide-react"

interface UploadDocumentDialogProps {
  clientId: string
  clientName: string
}

export function UploadDocumentDialog({ clientId, clientName }: UploadDocumentDialogProps) {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<string>("charges")
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)

    const formData = new FormData(e.currentTarget)
    formData.set("clientId", clientId)
    formData.set("category", category)

    const fileInput = e.currentTarget.querySelector('input[type="file"]') as HTMLInputElement
    if (!fileInput?.files?.[0]) {
      setError("Veuillez sélectionner un fichier à téléverser.")
      return
    }

    startTransition(async () => {
      const res = await uploadDocumentAction(formData)
      if (res.success) {
        setSuccessMsg("Document téléversé et classé sur Google Drive avec succès !")
        setTimeout(() => {
          setOpen(false)
          setSuccessMsg(null)
        }, 1200)
      } else {
        setError(res.error || "Échec du téléversement du document.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <Upload className="h-3.5 w-3.5" />
          <span>Téléverser</span>
        </Button>
      } />
      <DialogContent className="sm:max-w-[485px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Téléverser un document pour {clientName}
            </DialogTitle>
            <DialogDescription>
              Le fichier sera directement téléversé dans le dossier Google Drive correspondant à la catégorie sélectionnée.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-xs font-medium text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="rounded-md bg-emerald-500/15 p-3 text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="grid gap-2">
              <label htmlFor="doc-category" className="text-xs font-semibold text-foreground">
                Catégorie de dossier Drive *
              </label>
              <Select value={category} onValueChange={(val) => setCategory(val || "charges")} disabled={isPending}>
                <SelectTrigger id="doc-category" className="w-full">
                  <SelectValue placeholder="Sélectionnez la catégorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="charges">📁 Charges (Factures, Frais)</SelectItem>
                  <SelectItem value="salaires">📁 Salaires (Bulletins de paie)</SelectItem>
                  <SelectItem value="comptes">📁 Comptes (Relevés bancaires, Bilans)</SelectItem>
                  <SelectItem value="contrats">📁 Contrats (Statuts, Baux, Conventions)</SelectItem>
                  <SelectItem value="documents_generaux">📁 Documents Généraux (Courriers, Divers)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <label htmlFor="file" className="text-xs font-semibold text-foreground">
                Sélectionnez le fichier *
              </label>
              <Input
                id="file"
                name="file"
                type="file"
                required
                disabled={isPending}
                className="cursor-pointer text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Annuler
            </Button>
            <Button type="submit" disabled={isPending} className="gap-2">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Téléverser dans Drive
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
