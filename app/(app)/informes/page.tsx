import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";
import { Button } from "@/components/ui/button";
import { ReportList } from "@/components/report-list";
import { FileJson } from "lucide-react";

export const metadata = {
  title: "Informes"
};

export default async function ReportsPage() {
  const tenant = await getTenantContext();

  // Only authenticated users can view reports
  if (!["ADMIN", "SUPERVISOR", "OPERARIO"].includes(tenant.role)) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/10 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Informes</h1>
            <p className="text-muted-foreground mt-2">
              Descarga informes profesionales en PDF o Excel
            </p>
          </div>
          {["ADMIN", "SUPERVISOR"].includes(tenant.role) && (
            <Button asChild className="gap-2" size="default">
              <a href="/informes/generar">
                <FileJson className="h-4 w-4" />
                Generar Informe
              </a>
            </Button>
          )}
        </div>

        <ReportList companyId={tenant.companyId} />
      </div>
    </div>
  );
}
