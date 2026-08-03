import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ReportScheduleManager } from '@/components/report-schedule-manager';
import { ReportScheduleListItem } from '@/components/report-schedule-list-item';
import { ArrowLeft, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getTenantContext } from '@/lib/tenant';

export default async function ReportSchedulesPage() {
  const { companyId, role } = await getTenantContext();

  if (role !== 'ADMIN') {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 font-medium">Se requiere acceso de administrador.</p>
      </div>
    );
  }

  const supabase = await createClient();

  const { data: schedules } = await supabase
    .from('report_schedules')
    .select('*')
    .eq('company_id', companyId)
    .eq('enabled', true)
    .order('next_run_at', { ascending: true });

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
        <h1 className="text-3xl font-bold">Programación de informes</h1>
      </div>

      {/* Contenido principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulario */}
        <div className="lg:col-span-2">
          <ReportScheduleManager />
        </div>

        {/* Lista de programaciones */}
        <div>
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">
              Programaciones activas ({schedules?.length || 0})
            </h3>

            {schedules && schedules.length > 0 ? (
              <div className="space-y-3">
                {schedules.map((schedule: NonNullable<typeof schedules>[number]) => (
                  <ReportScheduleListItem
                    key={schedule.id}
                    id={schedule.id}
                    name={schedule.name}
                    reportEntity={schedule.report_entity}
                    reportFormat={schedule.report_format}
                    frequency={schedule.frequency}
                    nextRunAt={schedule.next_run_at}
                    emailRecipientCount={schedule.email_recipients?.length || 0}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Aún no hay programaciones</p>
                <p className="text-xs text-gray-500 mt-1">Crea una con el formulario</p>
              </div>
            )}
          </Card>

          {/* Información */}
          <Card className="p-4 bg-amber-50 mt-4 border-amber-200">
            <h4 className="font-semibold text-sm text-amber-900 mb-2">Función en desarrollo</h4>
            <p className="text-xs text-amber-800">
              Por ahora puedes guardar la configuración de una programación, pero el sistema
              todavía no la ejecuta automáticamente ni envía los informes por correo. Genera tus
              informes manualmente desde &quot;Generar Informe&quot; mientras se habilita esta función.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
