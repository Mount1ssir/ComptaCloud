import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const errorParam = url.searchParams.get("error")

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  const redirectTarget = `${siteUrl}/dashboard/settings/storage`

  if (errorParam || !code) {
    return NextResponse.redirect(`${redirectTarget}?status=error&message=${encodeURIComponent(errorParam || "no_code")}`)
  }

  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.redirect(`${siteUrl}/auth`)
  }

  // Defense-in-depth: Verify caller is cabinet_admin
  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile || profile.role !== "cabinet_admin" || !profile.tenant_id) {
    return NextResponse.redirect(`${redirectTarget}?status=error&message=unauthorized`)
  }

  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID!
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET!
  const encryptionKey = process.env.DRIVE_TOKEN_ENCRYPTION_KEY!
  const redirectUri = `${siteUrl}/api/drive/callback`

  try {
    // 1. Exchange authorization code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      })
    })

    const tokenData = await tokenResponse.json()

    if (!tokenResponse.ok || !tokenData.refresh_token) {
      console.error("Token exchange failed:", tokenData)
      return NextResponse.redirect(
        `${redirectTarget}?status=error&message=${encodeURIComponent(tokenData.error_description || "failed_to_get_refresh_token")}`
      )
    }

    const refreshToken = tokenData.refresh_token
    const accessToken = tokenData.access_token

    // 2. Fetch connected Google account email
    let connectedEmail: string | null = null
    if (accessToken) {
      try {
        const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` }
        })
        if (userInfoRes.ok) {
          const userInfo = await userInfoRes.json()
          connectedEmail = userInfo.email || null
        }
      } catch (e) {
        console.error("Failed to fetch userinfo email:", e)
      }
    }

    // 3. Save encrypted refresh token & connection state via RPC
    const { error: rpcError } = await supabase.rpc("save_tenant_drive_token", {
      p_tenant_id: profile.tenant_id,
      p_refresh_token: refreshToken,
      p_account_email: connectedEmail || "Connected Google Account",
      p_encryption_key: encryptionKey
    })

    if (rpcError) {
      console.error("Failed to save tenant drive token:", rpcError)
      return NextResponse.redirect(`${redirectTarget}?status=error&message=db_save_failed`)
    }

    // 4. Insert audit log
    await supabase.from("logs").insert({
      user_id: user.id,
      action: "drive_connected"
    })

    return NextResponse.redirect(`${redirectTarget}?status=success`)
  } catch (err: any) {
    console.error("OAuth callback error:", err)
    return NextResponse.redirect(`${redirectTarget}?status=error&message=internal_error`)
  }
}
