'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2 } from 'lucide-react';
import { deleteReportTemplate } from '@/lib/actions/reports';
import { getTemplateColorLabel, resolveTemplateColorHex } from '@/lib/reports/color-palette';
import type { EditableReportTemplate } from '@/components/report-template-builder';

const LAYOUT_LABELS: Record<string, string> = {
  standard: 'Estándar',
  executive: 'Ejecutivo',
  detailed: 'Detallado',
  comparison: 'Comparativo',
};

type Props = {
  template: EditableReportTemplate;
  isEditing: boolean;
  onEdit: (template: EditableReportTemplate) => void;
};

export function ReportTemplateListItem({ template, isEditing, onEdit }: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar la plantilla "${template.name}"? Esta acción no se puede deshacer.`)) return;

    setDeleting(true);
    const result = await deleteReportTemplate(template.id);
    setDeleting(false);

    if (!result.success) {
      alert(result.error || 'No se pudo eliminar la plantilla.');
      return;
    }

    router.refresh();
  };

  return (
    <div className={`p-3 border rounded-lg transition-colors ${isEditing ? 'border-blue-400 bg-blue-50' : 'hover:bg-gray-50'}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="font-medium text-sm">{template.name}</p>
          <p className="text-xs text-gray-500">{LAYOUT_LABELS[template.layout_type || 'standard'] || template.layout_type}</p>
        </div>
        <Badge variant="outline" className="flex-shrink-0 gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full border border-black/10"
            style={{ backgroundColor: resolveTemplateColorHex(template.color_scheme) }}
          />
          {getTemplateColorLabel(template.color_scheme)}
        </Badge>
      </div>

      <div className="mt-2 flex gap-2">
        <Button
          variant="ghost"
          size="xs"
          className="text-xs"
          onClick={() => onEdit(template)}
        >
          <Pencil className="mr-1 h-3 w-3" />
          Editar
        </Button>
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
    </div>
  );
}
