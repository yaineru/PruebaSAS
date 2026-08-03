import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/tenant";
import { TechnicalReportForm } from "@/components/technical-report-form";

export const metadata = {
  title: "Informes técnicos"
};

export default async function TechnicalReportsPage() {
  const tenant = await getTenantContext();

  if (!['ADMIN', 'SUPERVISOR', 'OPERARIO'].includes(tenant.role)) {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/10 p-4">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Informes técnicos</h1>
          <p className="mt-2 text-muted-foreground">
            Genera entregables operativos para clientes con encabezado corporativo, firmas y evidencias fotográficas.
          </p>
        </div>

        <TechnicalReportForm companyId={tenant.companyId} />
      </div>
    </div>
  );
}
