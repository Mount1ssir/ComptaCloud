import { DashboardHeader } from "@/components/dashboard-header"

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <DashboardHeader />
      <main className="flex-1 p-6 flex items-center justify-center">
        <div className="w-full max-w-6xl h-[400px] border-2 border-dashed border-border bg-muted/40 rounded-xl flex items-center justify-center p-8 text-center">
          <p className="text-muted-foreground text-lg max-w-lg">
            Bienvenue sur votre Dashboard. L'espace de travail est vide pour le moment.
          </p>
        </div>
      </main>
    </div>
  )
}
