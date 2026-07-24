import { createClient as createServerSupabaseClient } from "@/lib/supabase/server"

export interface GoogleDriveClient {
  tenantId: string
  accessToken: string
  fetchAbout: () => Promise<any>
}

/**
 * Server-only helper to obtain an authenticated Google Drive client for a given tenant.
 * Decrypts the stored refresh token via pgcrypto RPC and mints a fresh access token.
 */
export async function getGoogleDriveClient(tenantId: string): Promise<GoogleDriveClient> {
  if (!tenantId) {
    throw new Error("Tenant ID is required to get Google Drive client.")
  }

  const encryptionKey = process.env.DRIVE_TOKEN_ENCRYPTION_KEY
  if (!encryptionKey) {
    throw new Error("DRIVE_TOKEN_ENCRYPTION_KEY environment variable is not defined.")
  }

  const supabase = await createServerSupabaseClient()

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
    }
  }
}
