'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Palette } from 'lucide-react';
import { ReportTemplateBuilder, type EditableReportTemplate } from '@/components/report-template-builder';
import { ReportTemplateListItem } from '@/components/report-template-list-item';

type Props = {
  templates: EditableReportTemplate[];
};

export function ReportTemplatesManager({ templates }: Props) {
  const [editingTemplate, setEditingTemplate] = useState<EditableReportTemplate | null>(null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <ReportTemplateBuilder
          editingTemplate={editingTemplate}
          onCancelEdit={() => setEditingTemplate(null)}
          onSaved={() => setEditingTemplate(null)}
        />
      </div>

      <div>
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Tus plantillas ({templates.length})</h3>

          {templates.length > 0 ? (
            <div className="space-y-3">
              {templates.map((template) => (
                <ReportTemplateListItem
                  key={template.id}
                  template={template}
                  isEditing={editingTemplate?.id === template.id}
                  onEdit={setEditingTemplate}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Palette className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">Aún no hay plantillas</p>
              <p className="text-xs text-gray-500 mt-1">Crea una con el formulario</p>
            </div>
          )}
        </Card>

        <Card className="p-4 bg-blue-50 mt-4">
          <h4 className="font-semibold text-sm text-blue-900 mb-2">Plantillas incluidas</h4>
          <ul className="text-xs text-blue-800 space-y-1">
            <li>✓ Estándar - Detalle completo</li>
            <li>✓ Ejecutivo - Resumen</li>
            <li>✓ Detallado - Con gráficos</li>
            <li>✓ Comparativo - Período contra período</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
