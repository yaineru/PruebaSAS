import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/tenant";
import { getCompanySettings } from "@/lib/company-settings";
import { isModuleVisible } from "@/lib/niches";
import { TechnicalReportForm } from "@/components/technical-report-form";

export const metadata = {
  title: "Informes técnicos"
};

export default async function TechnicalReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ editId?: string }>;
}) {
  const tenant = await getTenantContext();
  const { editId } = await searchParams;

  if (!['ADMIN', 'SUPERVISOR', 'OPERARIO'].includes(tenant.role)) {
    redirect('/dashboard');
  }

  // Módulo oculto del sidebar para el nicho no debe seguir accesible por URL
  // directa (ver components/module-page.tsx para el mismo guard en los
  // módulos genéricos).
  const settings = await getCompanySettings(tenant.companyId, tenant.companyName);
  if (!isModuleVisible(settings.businessType, "technical_reports")) {
    redirect("/dashboard");
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

        {/* CAUSA RAÍZ confirmada de "aparecen datos de un cliente anterior":
            sin esta key, navegar de "Corregir informe X" a "Nuevo informe
            técnico" (o entre dos "Corregir" distintos) vía el Link del
            sidebar - navegación del lado del cliente, sin recarga completa -
            reutiliza la MISMA instancia de TechnicalReportForm. editReportId
            cambia como prop, pero ninguno de sus useEffect internos
            (restauración de borrador, carga para editar) resetea
            formState/evidencePhotos al pasar de un origen de datos al otro -
            son "mutuamente excluyentes" por diseño (ver el comentario en el
            propio componente) pero nada forzaba esa exclusión en tiempo de
            ejecución. Cambiar la key fuerza a React a desmontar y volver a
            montar el formulario desde cero cada vez que cambia a qué informe
            corresponde (o a "ninguno" = crear uno nuevo), que es exactamente
            la garantía que el componente ya asumía que tenía. */}
        <TechnicalReportForm key={editId ?? "new"} companyId={tenant.companyId} editReportId={editId} />
      </div>
    </div>
  );
}
