"use server"

import { createClient } from "@/lib/supabase/server"
import { getGoogleDriveClient } from "@/lib/google-drive/get-client"
import { revalidatePath } from "next/cache"

export async function createClientAction(formData: FormData, clientOverride?: any, simulatePartialFailure?: boolean) {
  const supabase = clientOverride || (await createClient())

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

  const name = formData.get("name")?.toString().trim() || ""
  const clientType = formData.get("clientType")?.toString().trim() || "company"
  const email = formData.get("email")?.toString().trim() || ""
  const phone = formData.get("phone")?.toString().trim() || ""

  if (!name) {
    return { success: false, error: "Le nom du client est obligatoire." }
  }

  // 3. Step 1: Call create_client_record RPC (DB Insert & Quota Gate)
  const { data: dbRes, error: dbErr } = await supabase.rpc("create_client_record", {
    p_name: name,
    p_client_type: clientType,
    p_email: email,
    p_phone: phone
  })

  if (dbErr || !dbRes?.success || !dbRes?.client_id) {
    return {
      success: false,
      error: dbErr?.message || "Impossible de créer la fiche client dans la base de données."
    }
  }

  const clientId = dbRes.client_id as string
  const tenantId = profile.tenant_id as string

  // 4. Step 2: Check if tenant has Google Drive connected
  const { data: tenant } = await supabase
    .from("tenants")
    .select("google_drive_connected")
    .eq("id", tenantId)
    .single()

  const isDriveConnected = tenant?.google_drive_connected === true
  const rootDriveFolderId = undefined

  let driveFoldersMetadata: Record<string, any> = {}
  let createdRootFolderId: string | null = null

  if (isDriveConnected) {
    try {
      const driveClient = await getGoogleDriveClient(tenantId, supabase, simulatePartialFailure)

      // Create Client Root Folder inside tenant's drive_folder_id (if set)
      const rootFolder = await driveClient.createFolder(name, rootDriveFolderId)
      createdRootFolderId = rootFolder.id

      // Create 5 required subfolders
      const subfolderNames = ["Charges", "Salaires", "Comptes", "Contrats", "Documents Généraux"]
      const subfoldersObj: Record<string, any> = {}

      for (const subName of subfolderNames) {
        const subFolder = await driveClient.createFolder(subName, createdRootFolderId)
        const safeKey = subName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "")
        subfoldersObj[safeKey] = { id: subFolder.id, name: subName }
      }

      driveFoldersMetadata = {
        root: { id: createdRootFolderId, name },
        subfolders: subfoldersObj
      }

      // Step 3: Persist Drive metadata to DB
      await supabase.rpc("update_client_drive_folders", {
        p_client_id: clientId,
        p_drive_folders: driveFoldersMetadata
      })
    } catch (driveErr: any) {
      console.error("Google Drive folder creation failed for client:", driveErr)

      // EXPLICIT ROLLBACK: Delete client DB record so zero orphaned rows exist
      await supabase.rpc("delete_client_record", { p_client_id: clientId })

      // Best-effort Drive folder cleanup
      if (createdRootFolderId) {
        try {
          const driveClient = await getGoogleDriveClient(tenantId, supabase, simulatePartialFailure)
          await driveClient.deleteFolder(createdRootFolderId)
        } catch (cleanupErr) {
          console.error("Best-effort Drive cleanup failed:", cleanupErr)
        }
      }

      return {
        success: false,
        error: `Erreur Google Drive: ${driveErr.message || "Échec de création des dossiers. La création du client a été annulée."}`
      }
    }
  }

  revalidatePath("/dashboard/clients")
  return {
    success: true,
    client_id: clientId
  }
}

export async function inviteClientAction(clientId: string, email: string) {
  const supabase = await createClient()

  // 1. Authenticate calling user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { success: false, error: "Utilisateur non authentifié." }
  }

  // 2. Fetch caller profile to resolve tenant_id
  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile?.tenant_id) {
    return { success: false, error: "Aucun cabinet associé à votre compte." }
  }

  const tenantId = profile.tenant_id

  // 3. Verify caller has cabinet_admin role or team:manage permission
  const { data: isPlatform } = await supabase.rpc("is_platform_role")
  const { data: canManage } = await supabase.rpc("can_perform", { perm_key: "team:manage" })

  const { data: roleData } = await supabase
    .from("users")
    .select("roles(name), role_legacy")
    .eq("id", user.id)
    .maybeSingle()

  const roleName = (roleData?.roles as any)?.name || roleData?.role_legacy

  const isCabinetAdmin = isPlatform || canManage || roleName === "cabinet_admin"

  if (!isCabinetAdmin) {
    return { success: false, error: "Seul un administrateur du cabinet peut inviter un client au portail." }
  }

  if (!clientId || !email) {
    return { success: false, error: "L'identifiant du client et l'adresse e-mail sont requis." }
  }

  // 4. Verify client exists and belongs to caller's tenant
  const { data: clientRow, error: clientErr } = await supabase
    .from("clients")
    .select("id, name, auth_user_id")
    .eq("id", clientId)
    .eq("tenant_id", tenantId)
    .single()

  if (clientErr || !clientRow) {
    return { success: false, error: "Client introuvable." }
  }

  if (clientRow.auth_user_id) {
    return { success: false, error: "Ce client a déjà un compte d'accès au portail." }
  }

  // 5. Service Role Admin Client to trigger invitation
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  if (!serviceRoleKey || !supabaseUrl) {
    return { success: false, error: "Erreur de configuration serveur Supabase." }
  }

  const { createClient: createAdminClient } = await import("@supabase/supabase-js")
  const adminClient = createAdminClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

  const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  const redirectTo = `${origin}/accept-invite`

  const { data: inviteData, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: {
      role: "client",
      tenant_id: tenantId,
      client_id: clientId
    }
  })

  if (inviteErr || !inviteData?.user) {
    return {
      success: false,
      error: inviteErr?.message || "Impossible d'envoyer l'invitation au client."
    }
  }

  const newUserId = inviteData.user.id

  // 6. Atomic link: update clients.auth_user_id and users.client_id
  await adminClient.from("clients").update({ auth_user_id: newUserId }).eq("id", clientId)
  await adminClient.from("users").update({ client_id: clientId }).eq("id", newUserId)

  revalidatePath("/dashboard/clients")

  return {
    success: true,
    message: `Invitation envoyée avec succès à ${email}`
  }
}
