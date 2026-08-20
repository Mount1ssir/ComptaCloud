"use server"

import { createClient } from "@/lib/supabase/server"
import { getGoogleDriveClient } from "@/lib/google-drive/get-client"
import { revalidatePath } from "next/cache"

export async function uploadDocumentAction(formData: FormData) {
  const supabase = await createClient()

  // 1. Authenticate caller user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { success: false, error: "Utilisateur non authentifié." }
  }

  // 2. Fetch profile to resolve caller's tenant_id
  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile?.tenant_id) {
    return { success: false, error: "Aucun cabinet associé à votre compte." }
  }

  const tenantId = profile.tenant_id

  // 3. Check upload permission (documents:upload)
  const { data: isAllowed } = await supabase.rpc("has_permission", { perm_key: "documents:upload" })
  const { data: isPlatform } = await supabase.rpc("is_platform_role")
  if (!isAllowed && !isPlatform) {
    return { success: false, error: "Vous n'êtes pas autorisé à téléverser des documents." }
  }

  // 4. Parse form inputs
  const clientId = formData.get("clientId")?.toString() || ""
  const category = formData.get("category")?.toString() || ""
  const file = formData.get("file") as File | null

  if (!clientId || !category || !file || file.size === 0) {
    return { success: false, error: "Veuillez sélectionner un client, une catégorie et un fichier valide." }
  }

  const validCategories = ['charges', 'salaires', 'comptes', 'contrats', 'documents_generaux']
  if (!validCategories.includes(category)) {
    return { success: false, error: "Catégorie de document invalide." }
  }

  // 5. Fetch client record and verify tenant ownership + drive_folders JSONB
  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select("id, name, drive_folders")
    .eq("id", clientId)
    .eq("tenant_id", tenantId)
    .single()

  if (clientErr || !client) {
    return { success: false, error: "Client introuvable ou vous n'avez pas accès à ce client." }
  }

  const driveFolders = (client.drive_folders || {}) as any
  const subfolders = driveFolders.subfolders || {}

  // Map category key to drive_folders JSONB key
  const categoryKeyMap: Record<string, string> = {
    charges: "Charges",
    salaires: "Salaires",
    comptes: "Comptes",
    contrats: "Contrats",
    documents_generaux: "DocumentsGeneraux"
  }

  const targetSubfolderObj = subfolders[categoryKeyMap[category]]
  const parentFolderId = targetSubfolderObj?.id || driveFolders.root?.id

  if (!parentFolderId) {
    return { success: false, error: "Aucun dossier Google Drive trouvé pour ce client. Veuillez vous assurer que Google Drive est connecté." }
  }

  // 6. Read file buffer
  const fileArrayBuffer = await file.arrayBuffer()
  const fileBuffer = Buffer.from(fileArrayBuffer)
  const fileName = file.name
  const mimeType = file.type || "application/octet-stream"
  const fileSizeBytes = file.size

  let uploadedDriveFile: { id: string; name: string; webViewLink: string } | null = null

  try {
    // Step A: Mint Drive client and upload file stream to target category subfolder
    const driveClient = await getGoogleDriveClient(tenantId, supabase)
    uploadedDriveFile = await driveClient.uploadFile(fileName, mimeType, fileBuffer, parentFolderId)

    // Step B: Insert record into public.documents table
    const { data: docRecord, error: dbInsertErr } = await supabase
      .from("documents")
      .insert({
        tenant_id: tenantId,
        client_id: clientId,
        category,
        drive_file_id: uploadedDriveFile.id,
        drive_web_view_link: uploadedDriveFile.webViewLink,
        file_name: fileName,
        file_size_bytes: fileSizeBytes,
        mime_type: mimeType,
        uploaded_by: user.id
      })
      .select("*")
      .single()

    if (dbInsertErr) {
      throw new Error(dbInsertErr.message || "Échec de l'enregistrement du document en base de données.")
    }

    revalidatePath("/dashboard/clients")
    revalidatePath("/dashboard/documents")

    return {
      success: true,
      document: docRecord
    }
  } catch (err: any) {
    console.error("Document upload failed:", err)

    // EXPLICIT ROLLBACK: Delete uploaded file from Drive if DB insert failed
    if (uploadedDriveFile?.id) {
      try {
        const driveClient = await getGoogleDriveClient(tenantId, supabase)
        await driveClient.deleteFile(uploadedDriveFile.id)
      } catch (cleanupErr) {
        console.error("Best-effort Drive file cleanup failed:", cleanupErr)
      }
    }

    return {
      success: false,
      error: err.message || "Erreur lors du téléversement du document."
    }
  }
}
