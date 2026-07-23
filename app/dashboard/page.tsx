import { DashboardHeader } from "@/components/dashboard-header"

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <DashboardHeader />
      <main className="flex flex-1 items-center justify-center p-6"></main>
    </div>
  )
}
