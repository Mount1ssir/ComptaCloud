import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard-header"
import { DashboardNav } from "@/components/dashboard-nav"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth")
  }

  // Fetch role and tenant branding for dynamic layout styling
  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id, role_id, roles(name), tenants(brand_primary_color, brand_secondary_color)")
    .eq("id", user.id)
    .maybeSingle()

  const rolesData = profile?.roles as unknown
  const roleName = Array.isArray(rolesData)
    ? (rolesData[0] as { name: string } | undefined)?.name || null
    : (rolesData as { name: string } | null)?.name || null

  const tenantData = profile?.tenants as unknown
  const primaryColor = Array.isArray(tenantData)
    ? (tenantData[0] as { brand_primary_color: string | null } | undefined)?.brand_primary_color || null
    : (tenantData as { brand_primary_color: string | null } | null)?.brand_primary_color || null

  const secondaryColor = Array.isArray(tenantData)
    ? (tenantData[0] as { brand_secondary_color: string | null } | undefined)?.brand_secondary_color || null
    : (tenantData as { brand_secondary_color: string | null } | null)?.brand_secondary_color || null

  const customStyle: Record<string, string> = {}
  if (primaryColor) {
    customStyle["--brand-primary"] = primaryColor
    customStyle["--primary"] = primaryColor
  }
  if (secondaryColor) {
    customStyle["--brand-secondary"] = secondaryColor
    customStyle["--secondary"] = secondaryColor
  }

  return (
    <div className="flex min-h-screen flex-col bg-background" style={customStyle}>
      <DashboardHeader />
      <DashboardNav userRole={roleName} />
      <div className="flex-1">{children}</div>
    </div>
  )
}
