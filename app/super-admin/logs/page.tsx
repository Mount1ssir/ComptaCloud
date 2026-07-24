import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { DashboardHeader } from "@/components/dashboard-header"
import { SuperAdminNav } from "@/components/super-admin-nav"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { IconStack } from "@/components/reui/icon-stack"
import { ChevronLeft, ChevronRight } from "lucide-react"

export const dynamic = "force-dynamic"

interface LogsPageProps {
  searchParams: Promise<{ page?: string }>
}

export default async function LogsPage({ searchParams }: LogsPageProps) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page || "1", 10))
  const pageSize = 25
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const supabase = await createClient()

  // 1. Fetch total count of logs
  const { count: totalLogs } = await supabase
    .from("logs")
    .select("*", { count: "exact", head: true })

  // 2. Fetch logs joined with users (to display acting user's email)
  const { data: logs, error } = await supabase
    .from("logs")
    .select(`
      id,
      action,
      timestamp,
      user_id,
      users:user_id (
        email
      )
    `)
    .order("timestamp", { ascending: false })
    .range(from, to)

  if (error) {
    console.error("Error fetching logs:", error)
  }

  const totalPages = Math.ceil((totalLogs || 0) / pageSize) || 1

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <DashboardHeader />
      <SuperAdminNav />

      <main className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Journaux d'audit (Logs System)</h1>
            <p className="text-sm text-muted-foreground">
              Historique de toutes les actions d'administration effectuées sur la plateforme.
            </p>
          </div>
          <Badge variant="outline" className="px-3 py-1 font-mono text-xs">
            Total: {totalLogs || 0} évènement(s)
          </Badge>
        </div>

        {/* Logs Table */}
        <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
          {!logs || logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
              <IconStack />
              <div className="space-y-1">
                <h3 className="font-semibold text-base text-foreground">Aucun journal d'audit</h3>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Aucune activité n'a été enregistrée pour le moment.
                </p>
              </div>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Horodatage (Timestamp)</TableHead>
                    <TableHead className="w-[240px]">Utilisateur (Email)</TableHead>
                    <TableHead>Action effectuée</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log: any) => {
                    const formattedDate = new Date(log.timestamp).toLocaleString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })

                    const userEmail = log.users?.email || (log.user_id ? `ID: ${log.user_id}` : "Système (Anonyme)")

                    return (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {formattedDate}
                        </TableCell>

                        <TableCell className="font-medium text-foreground text-xs">
                          {userEmail}
                        </TableCell>

                        <TableCell>
                          <code className="text-xs font-mono px-2 py-0.5 rounded-md bg-muted text-foreground border border-border">
                            {log.action}
                          </code>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>

              {/* Pagination Controls */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
                <span className="text-xs text-muted-foreground">
                  Page <strong className="text-foreground">{page}</strong> sur <strong className="text-foreground">{totalPages}</strong>
                </span>

                <div className="flex items-center space-x-2">
                  {page > 1 ? (
                    <Button variant="outline" size="sm" render={<Link href={`/super-admin/logs?page=${page - 1}`} />} className="h-8 text-xs flex items-center gap-1">
                      <ChevronLeft className="h-3.5 w-3.5" />
                      Précédent
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" disabled className="h-8 text-xs flex items-center gap-1">
                      <ChevronLeft className="h-3.5 w-3.5" />
                      Précédent
                    </Button>
                  )}

                  {page < totalPages ? (
                    <Button variant="outline" size="sm" render={<Link href={`/super-admin/logs?page=${page + 1}`} />} className="h-8 text-xs flex items-center gap-1">
                      Suivant
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" disabled className="h-8 text-xs flex items-center gap-1">
                      Suivant
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
