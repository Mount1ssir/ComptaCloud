"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Sun, Languages, Cloud, LogOut } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

export function DashboardHeader() {
  const router = useRouter()
  const supabase = createClient()
  const { resolvedTheme, setTheme } = useTheme()
  const [user, setUser] = React.useState<any>(null)
  const [cabinetName, setCabinetName] = React.useState<string>("Cabinet Platform")
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null)
  const [isCabinetAdmin, setIsCabinetAdmin] = React.useState<boolean>(false)

  React.useEffect(() => {
    const resolveCabinetName = async () => {
      let resolvedName: string | null = null
      let resolvedLogo: string | null = null

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser(user)

        const { data: userProfile } = await supabase
          .from("users")
          .select("tenant_id, roles(name)")
          .eq("id", user.id)
          .maybeSingle()

        const rolesData = userProfile?.roles as unknown
        const roleName = Array.isArray(rolesData)
          ? (rolesData[0] as { name: string } | undefined)?.name || null
          : (rolesData as { name: string } | null)?.name || null

        if (roleName === "cabinet_admin") {
          setIsCabinetAdmin(true)
        }

        if (userProfile?.tenant_id) {
          const { data: tenantById } = await supabase
            .from("tenants")
            .select("name, brand_logo_url")
            .eq("id", userProfile.tenant_id)
            .maybeSingle()

          if (tenantById) {
            resolvedName = tenantById.name
            resolvedLogo = tenantById.brand_logo_url
          }
        }
      }

      if (resolvedName) setCabinetName(resolvedName)
      if (resolvedLogo) setLogoUrl(resolvedLogo)
    }

    resolveCabinetName()
  }, [supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/")
  }

  const name = (user?.user_metadata?.full_name || "MUSTAPHA MOUNTASSIR").toUpperCase()
  const email = user?.email || "mustapha.mountassir@example.com"
  const initials = name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2) || "MM"

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background h-16">
      <div className="flex h-16 items-center justify-between px-6">
        {/* Left Side: Logo & Cabinet Name */}
        <Link
          href={isCabinetAdmin ? "/dashboard/settings/branding" : "/dashboard"}
          className="flex items-center gap-3 group hover:opacity-85 transition-opacity cursor-pointer"
          title={isCabinetAdmin ? "Personnaliser la marque et le logo du cabinet" : "Tableau de bord"}
        >
          {logoUrl && (
            <img src={logoUrl} alt={cabinetName} className="h-8 max-w-[140px] object-contain shrink-0" />
          )}
          <span className="text-lg font-bold tracking-tight text-foreground select-none group-hover:text-primary transition-colors">
            {cabinetName}
          </span>
        </Link>

        {/* Right Side: Icon Stack */}
        <div className="flex items-center gap-2">
          {/* Language Switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger render={
              <Button variant="ghost" size="icon" aria-label="Language">
                <Languages className="h-4 w-4" />
              </Button>
            } />
            <DropdownMenuContent align="end">
              <DropdownMenuItem>العربية</DropdownMenuItem>
              <DropdownMenuItem>Français</DropdownMenuItem>
              <DropdownMenuItem>English</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Theme Switcher */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            aria-label="Toggle Theme"
          >
            <Sun className="h-4 w-4" />
          </Button>

          {/* User Account Manager */}
          <DropdownMenu>
            <DropdownMenuTrigger render={
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full overflow-hidden">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </Button>
            } />
            <DropdownMenuContent align="end" className="w-72 p-1.5">
              {/* Custom Header */}
              <div className="flex items-center gap-3 px-2 py-3 select-none">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold text-foreground truncate leading-none">
                    {name}
                  </span>
                  <span className="text-xs text-muted-foreground truncate mt-1">
                    {email}
                  </span>
                </div>
              </div>

              <DropdownMenuSeparator />

              {/* Backup Sync */}
              <DropdownMenuItem
                className="flex items-center justify-between w-full cursor-pointer px-2.5 py-2"
                dir="rtl"
              >
                <span className="text-sm font-medium">Backup synchronization</span>
                <Cloud className="h-4 w-4 text-muted-foreground" />
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* Logout */}
              <DropdownMenuItem
                variant="destructive"
                className="flex items-center justify-between w-full cursor-pointer px-2.5 py-2"
                onClick={handleLogout}
                dir="rtl"
              >
                <span className="text-sm font-medium">Log out</span>
                <LogOut className="h-4 w-4" />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
