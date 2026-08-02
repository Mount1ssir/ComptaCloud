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

  // Fetch role for conditional nav display (cabinet_admin vs accountant/client)
  // OLD CHECK: .select("role")
  const { data: profile } = await supabase
    .from("users")
    .select("role_id, roles(name)")
    .eq("id", user.id)
    .maybeSingle()

  const rolesData = profile?.roles as unknown
  const roleName = Array.isArray(rolesData)
    ? (rolesData[0] as { name: string } | undefined)?.name || null
    : (rolesData as { name: string } | null)?.name || null

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <DashboardHeader />
      <DashboardNav userRole={roleName} />
      <div className="flex-1">{children}</div>
    </div>
  )
}
