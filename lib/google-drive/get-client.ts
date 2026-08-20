import { createClient as createServerSupabaseClient } from "@/lib/supabase/server"

export interface GoogleDriveClient {
  tenantId: string
  accessToken: string
  fetchAbout: () => Promise<any>
  createFolder: (folderName: string, parentFolderId?: string) => Promise<{ id: string; name: string }>
  deleteFolder: (folderId: string) => Promise<void>
  uploadFile: (fileName: string, mimeType: string, fileBuffer: Buffer, parentFolderId?: string) => Promise<{ id: string; name: string; webViewLink: string }>
  deleteFile: (fileId: string) => Promise<void>
}

/**
 * Server-only helper to obtain an authenticated Google Drive client for a given tenant.
 * Decrypts the stored refresh token via pgcrypto RPC and mints a fresh access token.
 */
export async function getGoogleDriveClient(tenantId: string, supabaseOverride?: any, simulatePartialFailure?: boolean): Promise<GoogleDriveClient> {
  if (!tenantId) {
    throw new Error("Tenant ID is required to get Google Drive client.")
  }

  if (simulatePartialFailure) {
    let folderCallCount = 0
    return {
      tenantId,
      accessToken: "mock_test_access_token",
      fetchAbout: async () => ({ user: { displayName: "Test User" } }),
      createFolder: async (folderName: string, parentFolderId?: string) => {
        folderCallCount++
        if (folderCallCount === 4) {
          throw new Error(`Google Drive API Error 403: Insufficient permissions to create subfolder "${folderName}" inside parent "${parentFolderId}"`)
        }
        return {
          id: `mock_drive_folder_${folderCallCount}_${folderName.toLowerCase().replace(/\s+/g, "_")}`,
          name: folderName
        }
      },
      deleteFolder: async (folderId: string) => {
        console.log(`[BEST-EFFORT DRIVE CLEANUP EXECUTED] Successfully called deleteFolder for root folder ID: ${folderId}`)
      },
      uploadFile: async (fileName: string, mimeType: string, fileBuffer: Buffer, parentFolderId?: string) => {
        const fileId = `mock_drive_file_${Date.now()}`
        return {
          id: fileId,
          name: fileName,
          webViewLink: `https://drive.google.com/file/d/${fileId}/view`
        }
      },
      deleteFile: async (fileId: string) => {
        console.log(`[BEST-EFFORT DRIVE CLEANUP EXECUTED] Successfully called deleteFile for file ID: ${fileId}`)
      }
    }
  }

  const encryptionKey = process.env.DRIVE_TOKEN_ENCRYPTION_KEY
  if (!encryptionKey) {
    throw new Error("DRIVE_TOKEN_ENCRYPTION_KEY environment variable is not defined.")
  }

  const supabase = supabaseOverride || (await createServerSupabaseClient())

  // Decrypt refresh token using SECURITY DEFINER RPC
  const { data: refreshToken, error: rpcError } = await supabase.rpc("get_tenant_drive_refresh_token", {
    p_tenant_id: tenantId,
    p_encryption_key: encryptionKey
  })

  if (rpcError || !refreshToken) {
    throw new Error(`Google Drive is not connected for tenant ${tenantId}. ${rpcError?.message || ""}`)
  }

  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error("Google Drive OAuth credentials (CLIENT_ID / CLIENT_SECRET) are missing.")
  }

  // Mint fresh access token from Google OAuth endpoint using refresh token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  })

  const tokenData = await tokenResponse.json()

  if (!tokenResponse.ok || !tokenData.access_token) {
    throw new Error(`Failed to mint access token from Google: ${tokenData.error_description || tokenData.error || "Unknown error"}`)
  }

  const accessToken: string = tokenData.access_token

  return {
    tenantId,
    accessToken,
    fetchAbout: async () => {
      const res = await fetch("https://www.googleapis.com/drive/v3/about?fields=user,storageQuota", {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      if (!res.ok) {
        throw new Error(`Drive About API call failed: ${res.statusText}`)
      }
      return await res.json()
    },
    createFolder: async (folderName: string, parentFolderId?: string) => {
      const metadata: Record<string, any> = {
        name: folderName,
        mimeType: "application/vnd.google-apps.folder"
      }
      if (parentFolderId) {
        metadata.parents = [parentFolderId]
      }

      const res = await fetch("https://www.googleapis.com/drive/v3/files?fields=id,name", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(metadata)
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(`Échec de création du dossier Drive "${folderName}": ${errData.error?.message || res.statusText}`)
      }

      return await res.json()
    },
    deleteFolder: async (folderId: string) => {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      if (!res.ok && res.status !== 404) {
        console.error(`Failed best-effort Drive folder deletion for ID ${folderId}: ${res.statusText}`)
      }
    },
    uploadFile: async (fileName: string, mimeType: string, fileBuffer: Buffer, parentFolderId?: string) => {
      const boundary = "-------314159265358979323846"
      const delimiter = `\r\n--${boundary}\r\n`
      const closeDelimiter = `\r\n--${boundary}--`

      const metadata: Record<string, any> = {
        name: fileName,
        mimeType: mimeType || "application/octet-stream"
      }
      if (parentFolderId) {
        metadata.parents = [parentFolderId]
      }

      const multipartBody = Buffer.concat([
        Buffer.from(`${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
        Buffer.from(`${delimiter}Content-Type: ${mimeType || "application/octet-stream"}\r\n\r\n`),
        fileBuffer,
        Buffer.from(closeDelimiter)
      ])

      const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`
        },
        body: multipartBody
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(`Échec du téléversement du fichier Drive "${fileName}": ${errData.error?.message || res.statusText}`)
      }

      const data = await res.json()
      return {
        id: data.id,
        name: data.name,
        webViewLink: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`
      }
    },
    deleteFile: async (fileId: string) => {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      if (!res.ok && res.status !== 404) {
        console.error(`Failed best-effort Drive file deletion for ID ${fileId}: ${res.statusText}`)
      }
    }
  }
}
