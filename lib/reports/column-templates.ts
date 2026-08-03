import { getEnumLabel, type EnumKey } from '@/lib/enums';
import { formatDate, formatCurrency, formatBytes } from '@/lib/utils';

export type ReportEntityKey = 'ASSETS' | 'MAINTENANCE' | 'INCIDENTS' | 'PROJECTS' | 'DOCUMENTS';

export type ReportColumnDef = {
  key: string;
  label: string;
  enumKey?: EnumKey;
  format?: 'date' | 'currency' | 'percent' | 'bytes';
};

export type ReportColumnTemplate = {
  select: string;
  columns: ReportColumnDef[];
};

/**
 * Plantillas por módulo: definen exactamente qué columnas de negocio se
 * exportan (whitelist) y cómo se traducen/formatean. Nunca deben incluir
 * metadata, company_id, created_by, updated_by, deleted_at ni ids crudos.
 */
export const REPORT_COLUMN_TEMPLATES: Record<ReportEntityKey, ReportColumnTemplate> = {
  ASSETS: {
    select:
      'code, name, plate, brand, model, year, location, provider, hour_meter, status, condition, purchase_date, acquisition_cost, current_value, insurance_expiration, technical_certificate_expiration, last_maintenance_date, next_maintenance_date',
    columns: [
      { key: 'code', label: 'Código' },
      { key: 'name', label: 'Nombre' },
      { key: 'plate', label: 'Placa' },
      { key: 'brand', label: 'Marca' },
      { key: 'model', label: 'Modelo' },
      { key: 'year', label: 'Año' },
      { key: 'location', label: 'Ubicación' },
      { key: 'provider', label: 'Proveedor' },
      { key: 'hour_meter', label: 'Horómetro' },
      { key: 'status', label: 'Estado', enumKey: 'assetStatus' },
      { key: 'condition', label: 'Condición', enumKey: 'assetCondition' },
      { key: 'purchase_date', label: 'Fecha de compra', format: 'date' },
      { key: 'acquisition_cost', label: 'Costo de adquisición', format: 'currency' },
      { key: 'current_value', label: 'Valor actual', format: 'currency' },
      { key: 'insurance_expiration', label: 'Vence póliza', format: 'date' },
      { key: 'technical_certificate_expiration', label: 'Vence certificado', format: 'date' },
      { key: 'last_maintenance_date', label: 'Último mantenimiento', format: 'date' },
      { key: 'next_maintenance_date', label: 'Próximo mantenimiento', format: 'date' },
    ],
  },
  MAINTENANCE: {
    select:
      'title, type, description, cost, responsible_name, due_date, status, observations, asset:assets(name,code), project:projects(name)',
    columns: [
      { key: 'title', label: 'Actividad' },
      { key: 'asset.name', label: 'Equipo' },
      { key: 'asset.code', label: 'Código activo' },
      { key: 'project.name', label: 'Proyecto' },
      { key: 'type', label: 'Tipo', enumKey: 'maintenanceType' },
      { key: 'description', label: 'Descripción' },
      { key: 'cost', label: 'Costo', format: 'currency' },
      { key: 'responsible_name', label: 'Responsable' },
      { key: 'due_date', label: 'Fecha programada', format: 'date' },
      { key: 'status', label: 'Estado', enumKey: 'maintenanceStatus' },
      { key: 'observations', label: 'Observaciones' },
    ],
  },
  INCIDENTS: {
    select:
      'title, description, priority, status, location, reported_at, resolved_at, resolution_notes, asset:assets(name,code), project:projects(name)',
    columns: [
      { key: 'title', label: 'Novedad' },
      { key: 'asset.name', label: 'Equipo' },
      { key: 'project.name', label: 'Proyecto' },
      { key: 'description', label: 'Descripción' },
      { key: 'priority', label: 'Prioridad', enumKey: 'incidentPriority' },
      { key: 'status', label: 'Estado', enumKey: 'incidentStatus' },
      { key: 'location', label: 'Ubicación' },
      { key: 'reported_at', label: 'Fecha de reporte', format: 'date' },
      { key: 'resolved_at', label: 'Fecha de resolución', format: 'date' },
      { key: 'resolution_notes', label: 'Notas de resolución' },
    ],
  },
  PROJECTS: {
    select: 'name, code, location, owner:users!owner_id(full_name), start_date, due_date, budget, progress, status',
    columns: [
      { key: 'name', label: 'Obra' },
      { key: 'code', label: 'Código' },
      { key: 'location', label: 'Ubicación' },
      { key: 'owner.full_name', label: 'Responsable' },
      { key: 'start_date', label: 'Fecha de inicio', format: 'date' },
      { key: 'due_date', label: 'Fecha final', format: 'date' },
      { key: 'budget', label: 'Presupuesto', format: 'currency' },
      { key: 'progress', label: 'Avance', format: 'percent' },
      { key: 'status', label: 'Estado', enumKey: 'projectStatus' },
    ],
  },
  DOCUMENTS: {
    select:
      'title, type, file_name, file_size, expires_at, status, uploaded_at, asset:assets(name,code), project:projects(name)',
    columns: [
      { key: 'title', label: 'Documento' },
      { key: 'asset.name', label: 'Equipo' },
      { key: 'project.name', label: 'Proyecto' },
      { key: 'type', label: 'Tipo', enumKey: 'documentType' },
      { key: 'file_name', label: 'Archivo' },
      { key: 'file_size', label: 'Tamaño', format: 'bytes' },
      { key: 'expires_at', label: 'Vencimiento', format: 'date' },
      { key: 'status', label: 'Estado', enumKey: 'recordStatus' },
      { key: 'uploaded_at', label: 'Fecha de carga', format: 'date' },
    ],
  },
};

function getPath(row: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, row);
}

export function formatColumnValue(row: Record<string, unknown>, column: ReportColumnDef): string {
  const raw = getPath(row, column.key);

  if (raw === null || raw === undefined || raw === '') return '';

  if (column.enumKey) return getEnumLabel(column.enumKey, raw);

  switch (column.format) {
    case 'date':
      return formatDate(String(raw));
    case 'currency':
      return formatCurrency(Number(raw));
    case 'percent':
      return `${Number(raw)}%`;
    case 'bytes':
      return formatBytes(Number(raw));
    default:
      break;
  }

  if (typeof raw === 'object') return JSON.stringify(raw);
  return String(raw);
}
