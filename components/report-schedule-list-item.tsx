'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Trash2 } from 'lucide-react';
import { deleteReportSchedule } from '@/lib/actions/reports';

const ENTITY_LABELS: Record<string, string> = {
  ASSETS: 'Equipos',
  INCIDENTS: 'Novedades',
  MAINTENANCE: 'Mantenimientos',
  PROJECTS: 'Proyectos',
};

const FREQUENCY_LABELS: Record<string, string> = {
  ONCE: 'Una vez',
  DAILY: 'Diaria',
  WEEKLY: 'Semanal',
  MONTHLY: 'Mensual',
};

function formatNextRun(date: string | null) {
  if (!date) return 'Sin programar';
  const next = new Date(date);
  const now = new Date();
  const hoursUntil = Math.floor((next.getTime() - now.getTime()) / (1000 * 60 * 60));

  if (hoursUntil < 0) return 'Atrasado';
  if (hoursUntil === 0) return 'Ejecutándose ahora';
  if (hoursUntil < 24) return `En ${hoursUntil} h`;

  const daysUntil = Math.floor(hoursUntil / 24);
  return `En ${daysUntil} d`;
}

type Props = {
  id: string;
  name: string;
  reportEntity: string;
  reportFormat: string;
  frequency: string;
  nextRunAt: string | null;
  emailRecipientCount: number;
};

export function ReportScheduleListItem({
  id,
  name,
  reportEntity,
  reportFormat,
  frequency,
  nextRunAt,
  emailRecipientCount,
}: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar la programación "${name}"? Esta acción no se puede deshacer.`)) return;

    setDeleting(true);
    const result = await deleteReportSchedule(id);
    setDeleting(false);

    if (!result.success) {
      alert(result.error || 'No se pudo eliminar la programación.');
      return;
    }

    router.refresh();
  };

  return (
    <div className="p-3 border rounded-lg hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <p className="font-medium text-sm">{name}</p>
        <Badge variant="outline" className="text-xs">
          {FREQUENCY_LABELS[frequency] || frequency}
        </Badge>
      </div>

      <p className="text-xs text-gray-600 mb-2">
        {ENTITY_LABELS[reportEntity] || reportEntity} • {reportFormat}
      </p>

      <div className="flex items-center gap-1 text-xs text-blue-600 mb-3">
        <Clock className="h-3 w-3" />
        {formatNextRun(nextRunAt)}
      </div>

      {emailRecipientCount > 0 && (
        <div className="text-xs text-gray-500 mb-2">
          📧 {emailRecipientCount} destinatario{emailRecipientCount !== 1 ? 's' : ''}
        </div>
      )}

      <Button
        variant="ghost"
        size="xs"
        className="text-xs text-red-600"
        onClick={handleDelete}
        disabled={deleting}
      >
        <Trash2 className="mr-1 h-3 w-3" />
        {deleting ? 'Eliminando...' : 'Eliminar'}
      </Button>
    </div>
  );
}
