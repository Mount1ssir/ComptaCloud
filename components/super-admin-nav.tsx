"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Building2, History } from "lucide-react"

export function SuperAdminNav() {
  const pathname = usePathname()

  const navItems = [
    {
      label: "Vue d'ensemble",
      href: "/super-admin",
      icon: LayoutDashboard,
      active: pathname === "/super-admin",
    },
    {
      label: "Cabinets (Tenants)",
      href: "/super-admin/tenants",
      icon: Building2,
      active: pathname === "/super-admin/tenants",
    },
    {
      label: "Journaux d'audit (Logs)",
      href: "/super-admin/logs",
      icon: History,
      active: pathname === "/super-admin/logs",
    },
  ]

  return (
    <div className="border-b border-border bg-card/50 px-6">
      <nav className="flex space-x-6 overflow-x-auto py-2">
        {navItems.map((item) => {
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
