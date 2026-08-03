import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { ReportGenerator } from "@/components/report-generator";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Generar Informe"
};

export default async function GenerateReportPage() {
  const tenant = await getTenantContext();

  // Only ADMIN and SUPERVISOR can generate reports
  if (!["ADMIN", "SUPERVISOR"].includes(tenant.role)) {
    redirect("/");
  }

  const supabase = await createClient();
  const { data: templates } = await supabase
    .from("report_templates")
    .select("id,name,color_scheme")
    .eq("company_id", tenant.companyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/10 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Generar Informe</h1>
          <p className="text-muted-foreground mt-2">
            Crea informes profesionales en PDF o Excel con datos filtrados
          </p>
        </div>

        <ReportGenerator
          companyId={tenant.companyId}
          templates={templates || []}
        />
      </div>
    </div>
  );
}
