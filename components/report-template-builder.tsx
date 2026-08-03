'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createReportTemplate, updateReportTemplate } from '@/lib/actions/reports';
import { TEMPLATE_COLOR_PALETTE } from '@/lib/reports/color-palette';
import { ZoomIn, X } from 'lucide-react';

export type EditableReportTemplate = {
  id: string;
  name: string;
  slug: string;
  layout_type: string;
  color_scheme: string;
  include_logo: boolean;
  page_size: string;
  orientation: string;
  margin_top: number;
  margin_bottom: number;
  margin_left: number;
  margin_right: number;
};

type FormState = {
  name: string;
  slug: string;
  layoutType: string;
  colorScheme: string;
  includeLogo: boolean;
  includeCharts: boolean;
  includeTable: boolean;
  includeSummary: boolean;
  pageSize: string;
  orientation: string;
  marginTop: string;
  marginBottom: string;
  marginLeft: string;
  marginRight: string;
};

const EMPTY_FORM: FormState = {
  name: '',
  slug: '',
  layoutType: 'standard',
  colorScheme: 'blue',
  includeLogo: true,
  includeCharts: true,
  includeTable: true,
  includeSummary: true,
  pageSize: 'A4',
  orientation: 'portrait',
  marginTop: '1.0',
  marginBottom: '1.0',
  marginLeft: '0.75',
  marginRight: '0.75',
};

function formFromTemplate(template: EditableReportTemplate): FormState {
  return {
    name: template.name,
    slug: template.slug,
    layoutType: template.layout_type || 'standard',
    colorScheme: template.color_scheme || 'blue',
    includeLogo: template.include_logo ?? true,
    includeCharts: true,
    includeTable: true,
    includeSummary: true,
    pageSize: template.page_size || 'A4',
    orientation: template.orientation || 'portrait',
    marginTop: String(template.margin_top ?? 1.0),
    marginBottom: String(template.margin_bottom ?? 1.0),
    marginLeft: String(template.margin_left ?? 0.75),
    marginRight: String(template.margin_right ?? 0.75),
  };
}

type Props = {
  editingTemplate?: EditableReportTemplate | null;
  onCancelEdit?: () => void;
  onSaved?: () => void;
};

export function ReportTemplateBuilder({ editingTemplate, onCancelEdit, onSaved }: Props) {
  const router = useRouter();
  const isEditing = Boolean(editingTemplate);
  const [formData, setFormData] = useState<FormState>(
    editingTemplate ? formFromTemplate(editingTemplate) : EMPTY_FORM
  );
  const [customColor, setCustomColor] = useState(() => {
    const scheme = editingTemplate?.color_scheme;
    return scheme && /^#[0-9A-Fa-f]{6}$/.test(scheme) ? scheme : '#0F766E';
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [slugTouched, setSlugTouched] = useState(isEditing);

  useEffect(() => {
    setFormData(editingTemplate ? formFromTemplate(editingTemplate) : EMPTY_FORM);
    setSlugTouched(Boolean(editingTemplate));
    setError('');
    setSuccess('');
  }, [editingTemplate]);

  const handleChange = (field: keyof FormState, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // El identificador (URL) es obligatorio pero no tiene ninguna pista visual
  // de serlo, y nada lo generaba a partir del nombre - un usuario llenando
  // "Nombre de la plantilla" y dejando esto en blanco solo se topa con el
  // tooltip nativo del navegador (invisible salvo que se fije bien) al
  // enviar. Se genera solo a partir del nombre, igual que WordPress/Notion,
  // y el campo sigue siendo editable para quien quiera un identificador propio.
  const handleNameChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      name: value,
      slug: slugTouched
        ? prev.slug
        : value
            .toLowerCase()
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
    }));
  };

  const isCustomColor = !TEMPLATE_COLOR_PALETTE.some((c) => c.value === formData.colorScheme);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    const form = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      form.append(key.replace(/([A-Z])/g, '_$1').toLowerCase(), String(value));
    });

    const result = isEditing && editingTemplate
      ? await updateReportTemplate(editingTemplate.id, form)
      : await createReportTemplate(form);
    setSubmitting(false);

    if (result.success) {
      setSuccess(isEditing ? '¡Plantilla actualizada correctamente!' : '¡Plantilla creada correctamente!');
      if (!isEditing) {
        setFormData(EMPTY_FORM);
      }
      // La lista de plantillas la trae el server component padre en el render
      // inicial de la página; sin este refresh, los cambios solo aparecían
      // después de recargar manualmente.
      router.refresh();
      onSaved?.();
    } else {
      setError(result.error || 'No se pudo guardar la plantilla.');
    }
  };

  const layoutLabels: Record<string, string> = {
    standard: 'Estándar',
    executive: 'Ejecutivo',
    detailed: 'Detallado',
    comparison: 'Comparativo',
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <ZoomIn className="w-5 h-5" />
              {isEditing ? `Editar plantilla: ${editingTemplate?.name}` : 'Crear plantilla de informe'}
            </span>
            {isEditing && (
              <Button type="button" variant="ghost" size="sm" onClick={onCancelEdit}>
                <X className="mr-1 h-4 w-4" />
                Cancelar
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Datos de la plantilla */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Nombre de la plantilla</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Ej. Informe de ventas"
                  required
                />
              </div>
              <div>
                <Label htmlFor="slug">Identificador (URL)</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    handleChange('slug', e.target.value.toLowerCase().replace(/\s+/g, '-'));
                  }}
                  placeholder="Ej. informe-de-ventas"
                  required
                />
              </div>
            </div>

            {/* Tipo de diseño */}
            <div>
              <Label>Tipo de diseño</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                {['standard', 'executive', 'detailed', 'comparison'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleChange('layoutType', type)}
                    className={`px-3 py-2 rounded border text-sm transition ${
                      formData.layoutType === type
                        ? 'bg-blue-500 text-white border-blue-600'
                        : 'bg-gray-50 border-gray-300'
                    }`}
                  >
                    {layoutLabels[type]}
                  </button>
                ))}
              </div>
            </div>

            {/* Esquema de color */}
            <div>
              <Label>Esquema de color</Label>
              <div className="mt-2 grid grid-cols-3 sm:grid-cols-6 gap-2">
                {TEMPLATE_COLOR_PALETTE.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => handleChange('colorScheme', color.value)}
                    className={`flex flex-col items-center gap-1 rounded-md border p-2 text-xs transition ${
                      formData.colorScheme === color.value ? 'border-gray-900 ring-2 ring-offset-1 ring-gray-900' : 'border-gray-300'
                    }`}
                    title={color.label}
                  >
                    <span
                      className="h-6 w-6 rounded-full border border-black/10"
                      style={{ backgroundColor: color.hex }}
                    />
                    <span className="truncate w-full text-center">{color.label}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleChange('colorScheme', customColor)}
                  className={`flex flex-col items-center gap-1 rounded-md border p-2 text-xs transition ${
                    isCustomColor ? 'border-gray-900 ring-2 ring-offset-1 ring-gray-900' : 'border-gray-300'
                  }`}
                  title="Personalizado"
                >
                  <input
                    type="color"
                    value={customColor}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      setCustomColor(e.target.value);
                      handleChange('colorScheme', e.target.value);
                    }}
                    className="h-6 w-6 cursor-pointer rounded-full border border-black/10 p-0"
                  />
                  <span>Personalizado</span>
                </button>
              </div>
            </div>

            {/* Contenido a incluir */}
            <div className="space-y-3">
              <Label>Incluir en el informe</Label>
              {(
                [
                  { key: 'includeLogo', label: 'Logo de la empresa' },
                  { key: 'includeCharts', label: 'Gráficos' },
                  { key: 'includeTable', label: 'Tabla de datos' },
                  { key: 'includeSummary', label: 'Resumen' },
                ] satisfies Array<{ key: keyof FormState; label: string }>
              ).map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={key}
                    checked={Boolean(formData[key])}
                    onChange={(e) => handleChange(key, e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <label htmlFor={key} className="text-sm">
                    {label}
                  </label>
                </div>
              ))}
            </div>

            {/* Configuración de página */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pageSize">Tamaño de página</Label>
                <select
                  id="pageSize"
                  value={formData.pageSize}
                  onChange={(e) => handleChange('pageSize', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="A4">A4</option>
                  <option value="Letter">Carta</option>
                  <option value="Legal">Oficio</option>
                </select>
              </div>
              <div>
                <Label htmlFor="orientation">Orientación</Label>
                <select
                  id="orientation"
                  value={formData.orientation}
                  onChange={(e) => handleChange('orientation', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="portrait">Vertical</option>
                  <option value="landscape">Horizontal</option>
                </select>
              </div>
            </div>

            {/* Márgenes */}
            <div>
              <Label>Márgenes (pulgadas)</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                {(
                  [
                    { key: 'marginTop', label: 'Superior' },
                    { key: 'marginBottom', label: 'Inferior' },
                    { key: 'marginLeft', label: 'Izquierdo' },
                    { key: 'marginRight', label: 'Derecho' },
                  ] satisfies Array<{ key: keyof FormState; label: string }>
                ).map(({ key, label }) => (
                  <div key={key}>
                    <label className="text-xs text-gray-600">{label}</label>
                    <Input
                      type="number"
                      step="0.1"
                      value={String(formData[key])}
                      onChange={(e) => handleChange(key, e.target.value)}
                      className="mt-1"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Mensajes */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>
            )}
            {success && (
              <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">
                {success}
              </div>
            )}

            {/* Enviar */}
            <Button type="submit" disabled={submitting} className="w-full bg-blue-600 hover:bg-blue-700">
              {submitting ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear plantilla'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
