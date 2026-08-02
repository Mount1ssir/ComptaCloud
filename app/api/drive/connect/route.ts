import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.redirect(new URL("/auth", request.url))
  }

  // Fetch calling user profile to get tenant_id for OAuth state parameter
  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .maybeSingle()

  // Defense-in-depth: Verify calling user has 'drive:connect' permission (or super_admin bypass)
  // OLD CHECK: if (!profile || profile.role !== "cabinet_admin" || !profile.tenant_id)
  const { data: isAuthorized } = await supabase.rpc("can_perform", { perm_key: "drive:connect" })

  if (!profile || !profile.tenant_id || !isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  const redirectUri = `${siteUrl}/api/drive/callback`
  const scope = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email"

  if (!clientId) {
    return NextResponse.json({ error: "GOOGLE_DRIVE_CLIENT_ID is missing" }, { status: 500 })
  }

  const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth")
  googleAuthUrl.searchParams.set("client_id", clientId)
  googleAuthUrl.searchParams.set("redirect_uri", redirectUri)
  googleAuthUrl.searchParams.set("response_type", "code")
  googleAuthUrl.searchParams.set("scope", scope)
  googleAuthUrl.searchParams.set("access_type", "offline")
  googleAuthUrl.searchParams.set("prompt", "consent")
  googleAuthUrl.searchParams.set("state", profile.tenant_id)

  return NextResponse.redirect(googleAuthUrl.toString())
}
