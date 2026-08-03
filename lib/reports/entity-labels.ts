import type { ReportEntityKey } from '@/lib/reports/column-templates';

/**
 * Human-readable Spanish labels for each report entity. Used anywhere a
 * ReportEntity enum value would otherwise be printed raw (e.g. "Informe
 * profesional de ASSETS" instead of "... de Equipos").
 */
export const REPORT_ENTITY_LABELS: Record<ReportEntityKey, string> = {
  ASSETS: 'Equipos',
  MAINTENANCE: 'Mantenimientos',
  INCIDENTS: 'Novedades',
  PROJECTS: 'Proyectos',
  DOCUMENTS: 'Documentos',
};
