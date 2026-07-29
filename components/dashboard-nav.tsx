"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Users, HardDrive } from "lucide-react"

interface DashboardNavProps {
  userRole?: string | null
}

export function DashboardNav({ userRole }: DashboardNavProps) {
  const pathname = usePathname()

  const isCabinetAdmin = userRole === "cabinet_admin"

  const navItems = [
    {
      label: "Vue d'ensemble",
      href: "/dashboard",
      icon: LayoutDashboard,
      active: pathname === "/dashboard",
      adminOnly: false,
    },
    {
      label: "Équipe",
      href: "/dashboard/team",
      icon: Users,
      active: pathname.startsWith("/dashboard/team"),
      adminOnly: true,
    },
    {
      label: "Stockage",
      href: "/dashboard/settings/storage",
      icon: HardDrive,
      active: pathname.startsWith("/dashboard/settings/storage"),
      adminOnly: true,
    },
  ]

  // Filter links: non-admin roles (accountant/client) see only non-admin links ("Vue d'ensemble")
  const visibleNavItems = navItems.filter((item) => !item.adminOnly || isCabinetAdmin)

  return (
    <div className="border-b border-border bg-card/50 px-6">
      <nav className="flex space-x-6 overflow-x-auto py-2">
        {visibleNavItems.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                item.active
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
