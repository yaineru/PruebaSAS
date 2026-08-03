import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ReportTemplatesManager } from '@/components/report-templates-manager';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getTenantContext } from '@/lib/tenant';

export default async function ReportTemplatesPage() {
  const { companyId, role } = await getTenantContext();

  if (role !== 'ADMIN') {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 font-medium">Se requiere acceso de administrador.</p>
      </div>
    );
  }

  const supabase = await createClient();

  const { data: templates } = await supabase
    .from('report_templates')
    .select('id,name,slug,layout_type,color_scheme,include_logo,page_size,orientation,margin_top,margin_bottom,margin_left,margin_right')
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center gap-4">
        <Link href="/informes">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Informes
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Plantillas de informes</h1>
      </div>

      <ReportTemplatesManager templates={templates || []} />
    </div>
  );
}
