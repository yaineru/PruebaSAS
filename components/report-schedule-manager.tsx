'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createReportSchedule } from '@/lib/actions/reports';
import { Clock } from 'lucide-react';

const ENTITY_LABELS: Record<string, string> = {
  ASSETS: 'Equipos',
  INCIDENTS: 'Novedades',
  MAINTENANCE: 'Mantenimientos',
  PROJECTS: 'Proyectos',
};

export function ReportScheduleManager() {
  const router = useRouter();
  const [newSchedule, setNewSchedule] = useState({
    name: '',
    reportEntity: 'ASSETS',
    frequency: 'WEEKLY',
    timeOfDay: '09:00:00',
    reportFormat: 'PDF',
    emailRecipients: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    const form = new FormData();
    form.append('name', newSchedule.name);
    form.append('report_entity', newSchedule.reportEntity);
    form.append('frequency', newSchedule.frequency);
    form.append('time_of_day', newSchedule.timeOfDay);
    form.append('report_format', newSchedule.reportFormat);
    form.append('email_recipients', newSchedule.emailRecipients);

    const result = await createReportSchedule(form);
    setSubmitting(false);

    if (result.success) {
      setSuccess('¡Programación creada correctamente!');
      setNewSchedule({
        name: '',
        reportEntity: 'ASSETS',
        frequency: 'WEEKLY',
        timeOfDay: '09:00:00',
        reportFormat: 'PDF',
        emailRecipients: '',
      });
      router.refresh();
    } else {
      setError(result.error || 'No se pudo crear la programación.');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Programar informe
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Nombre de la programación</Label>
                <Input
                  id="name"
                  value={newSchedule.name}
                  onChange={(e) => setNewSchedule({ ...newSchedule, name: e.target.value })}
                  placeholder="Ej. Informe semanal de activos"
                  required
                />
              </div>

              <div>
                <Label htmlFor="entity">Entidad del informe</Label>
                <select
                  id="entity"
                  value={newSchedule.reportEntity}
                  onChange={(e) => setNewSchedule({ ...newSchedule, reportEntity: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  {['ASSETS', 'INCIDENTS', 'MAINTENANCE', 'PROJECTS'].map((entity) => (
                    <option key={entity} value={entity}>
                      {ENTITY_LABELS[entity]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="frequency">Frecuencia</Label>
                <select
                  id="frequency"
                  value={newSchedule.frequency}
                  onChange={(e) => setNewSchedule({ ...newSchedule, frequency: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="DAILY">Diaria</option>
                  <option value="WEEKLY">Semanal</option>
                  <option value="MONTHLY">Mensual</option>
                </select>
              </div>

              <div>
                <Label htmlFor="time">Hora del día</Label>
                <Input
                  id="time"
                  type="time"
                  value={newSchedule.timeOfDay.slice(0, 5)}
                  onChange={(e) => setNewSchedule({ ...newSchedule, timeOfDay: e.target.value + ':00' })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="format">Formato</Label>
                <select
                  id="format"
                  value={newSchedule.reportFormat}
                  onChange={(e) => setNewSchedule({ ...newSchedule, reportFormat: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="PDF">PDF</option>
                  <option value="EXCEL">Excel</option>
                  <option value="BOTH">Ambos</option>
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="emails">Destinatarios (separados por coma)</Label>
              <Input
                id="emails"
                value={newSchedule.emailRecipients}
                onChange={(e) => setNewSchedule({ ...newSchedule, emailRecipients: e.target.value })}
                placeholder="correo1@empresa.com, correo2@empresa.com"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>
            )}
            {success && (
              <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">
                {success}
              </div>
            )}

            <Button type="submit" disabled={submitting} className="w-full bg-blue-600 hover:bg-blue-700">
              {submitting ? 'Creando...' : 'Crear programación'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
