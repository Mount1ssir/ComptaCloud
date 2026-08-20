"use client"

import { useState, useTransition } from "react"
import { updateBrandingAction } from "@/app/dashboard/settings/branding-actions"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Upload, Sparkles, AlertCircle, CheckCircle2, Loader2, Image as ImageIcon } from "lucide-react"

interface BrandingFormProps {
  tenantId: string
  initialLogoUrl: string | null
  initialPrimaryColor: string | null
  initialSecondaryColor: string | null
}

export function BrandingForm({
  tenantId,
  initialLogoUrl,
  initialPrimaryColor,
  initialSecondaryColor
}: BrandingFormProps) {
  const supabase = createClient()
  const [logoUrl, setLogoUrl] = useState<string>(initialLogoUrl || "")
  const [primaryColor, setPrimaryColor] = useState<string>(initialPrimaryColor || "#0F172A")
  const [secondaryColor, setSecondaryColor] = useState<string>(initialSecondaryColor || "#3B82F6")

  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)

    try {
      const fileExt = file.name.split('.').pop()
      const filePath = `${tenantId}/logo-${Date.now()}.${fileExt}`

      const { data, error: uploadErr } = await supabase.storage
        .from('tenant-branding')
        .upload(filePath, file, { upsert: true })

      if (uploadErr) {
        throw new Error(uploadErr.message || "Échec du téléchargement du logo.")
      }

      const { data: publicUrlData } = supabase.storage
        .from('tenant-branding')
        .getPublicUrl(filePath)

      setLogoUrl(publicUrlData.publicUrl)
    } catch (err: any) {
      setError(err.message || "Impossible de télécharger l'image du logo.")
    } finally {
      setUploading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)

    const formData = new FormData()
    formData.set("logoUrl", logoUrl)
    formData.set("primaryColor", primaryColor)
    formData.set("secondaryColor", secondaryColor)

    startTransition(async () => {
      const res = await updateBrandingAction(formData)
      if (res.success) {
        setSuccessMsg("Personnalisation de la marque enregistrée avec succès.")
      } else {
        setError(res.error || "Une erreur est survenue lors de l'enregistrement.")
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-destructive/15 p-4 text-sm text-destructive font-medium flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="rounded-md bg-emerald-500/15 p-4 text-sm text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Logo Upload Section */}
      <div className="rounded-xl border bg-card p-6 space-y-4 shadow-xs">
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-primary" />
          Logo du Cabinet
        </h3>
        <p className="text-xs text-muted-foreground">
          Téléchargez le logo officiel de votre cabinet. Il sera affiché dans l'en-tête de votre espace de travail.
        </p>

        <div className="flex items-center gap-6 pt-2">
          <div className="h-20 w-44 rounded-lg border-2 border-dashed border-border bg-muted/30 flex items-center justify-center overflow-hidden p-2">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo Cabinet" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-xs text-muted-foreground font-mono">Aucun logo</span>
            )}
          </div>

          <div className="space-y-2">
            <label className="cursor-pointer inline-block">
              <span className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 gap-2">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? "Téléchargement..." : "Choisir une image"}
              </span>
              <input
                type="file"
                accept="image/png, image/jpeg, image/svg+xml, image/webp"
                className="hidden"
                onChange={handleLogoUpload}
                disabled={uploading || isPending}
              />
            </label>
            <p className="text-[11px] text-muted-foreground">Formats acceptés: PNG, JPG, SVG, WebP (max 2 Mo)</p>
          </div>
        </div>
      </div>

      {/* Colors Section */}
      <div className="rounded-xl border bg-card p-6 space-y-4 shadow-xs">
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Palette de Couleurs de la Marque
        </h3>
        <p className="text-xs text-muted-foreground">
          Définissez la couleur principale et secondaire adaptées à la charte graphique de votre cabinet.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground">Couleur Principale (Primary)</label>
            <div className="flex items-center gap-3">
              <Input
                type="color"
                value={primaryColor}
                onChange={e => setPrimaryColor(e.target.value)}
                className="h-10 w-16 p-1 cursor-pointer"
                disabled={isPending}
              />
              <Input
                type="text"
                value={primaryColor}
                onChange={e => setPrimaryColor(e.target.value)}
                className="font-mono text-sm uppercase"
                disabled={isPending}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground">Couleur Secondaire (Secondary)</label>
            <div className="flex items-center gap-3">
              <Input
                type="color"
                value={secondaryColor}
                onChange={e => setSecondaryColor(e.target.value)}
                className="h-10 w-16 p-1 cursor-pointer"
                disabled={isPending}
              />
              <Input
                type="text"
                value={secondaryColor}
                onChange={e => setSecondaryColor(e.target.value)}
                className="font-mono text-sm uppercase"
                disabled={isPending}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Live Preview Card */}
      <div className="rounded-xl border bg-card p-6 space-y-3 shadow-xs">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Aperçu en Direct du Thème
        </h4>
        <div className="rounded-lg p-6 border shadow-xs space-y-4" style={{ backgroundColor: '#F8FAFC' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img src={logoUrl} alt="Preview Logo" className="h-8 object-contain" />
              ) : (
                <span className="text-lg font-bold" style={{ color: primaryColor }}>Mon Cabinet</span>
              )}
            </div>
            <div className="h-8 px-4 rounded-md flex items-center text-xs font-medium text-white shadow-xs" style={{ backgroundColor: primaryColor }}>
              Bouton Principal
            </div>
          </div>
          <div className="h-2 rounded-full w-2/3" style={{ backgroundColor: secondaryColor }} />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" className="gap-2 px-6" disabled={isPending || uploading}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Enregistrer les modifications
        </Button>
      </div>
    </form>
  )
}
