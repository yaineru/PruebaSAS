import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/tenant";
import { getCompanySettings } from "@/lib/company-settings";
import { isModuleVisible } from "@/lib/niches";
import { TechnicalReportForm } from "@/components/technical-report-form";

export const metadata = {
  title: "Informes técnicos"
};

export default async function TechnicalReportsPage() {
  const tenant = await getTenantContext();

  if (!['ADMIN', 'SUPERVISOR', 'OPERARIO'].includes(tenant.role)) {
    redirect('/');
  }

  // Módulo oculto del sidebar para el nicho no debe seguir accesible por URL
  // directa (ver components/module-page.tsx para el mismo guard en los
  // módulos genéricos).
  const settings = await getCompanySettings(tenant.companyId, tenant.companyName);
  if (!isModuleVisible(settings.businessType, "technical_reports")) {
    redirect("/");
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
