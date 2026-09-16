// Tipos y lógica pura de la evidencia fotográfica de informes técnicos,
// separados de generators.ts a propósito: generators.ts se importa
// dinámicamente desde lib/actions/reports.ts (un archivo "use server"), y
// Next.js exige que TODO lo exportado desde un módulo alcanzable así sea una
// función async - normalizeEvidenceItems es síncrona, así que vive aquí,
// donde también es más fácil de probar de forma aislada (sin arrastrar las
// dependencias pesadas de generators.ts como jsPDF/sharp/exceljs).

export type TechnicalReportEvidenceType = 'BEFORE' | 'AFTER' | 'EVIDENCE';

export type TechnicalReportEvidenceItem = {
  title?: string;
  url?: string | null;
  type?: TechnicalReportEvidenceType;
  // Forma antigua (informes generados antes de este cambio, cuando cada
  // "item" era un par Antes+Después en vez de una foto independiente).
  // Nunca se escribe en informes nuevos - solo se acepta en lectura por si
  // algo llegara a releer un evidence_items histórico, para no perder esas
  // fotos si eso ocurre.
  beforeUrl?: string | null;
  afterUrl?: string | null;
};

export const EVIDENCE_TYPE_LABELS: Record<TechnicalReportEvidenceType, string> = {
  BEFORE: 'Antes',
  AFTER: 'Después',
  EVIDENCE: 'Evidencia',
};

// Normaliza cualquier mezcla de items nuevos ({url, type}) y antiguos
// ({beforeUrl, afterUrl}) a una lista plana de fotos con tipo. Un item
// antiguo con ambas URLs se expande en dos fotos (Antes y Después).
export type NormalizedEvidencePhoto = { title?: string; url: string; type: TechnicalReportEvidenceType };

export function normalizeEvidenceItems(items: TechnicalReportEvidenceItem[]): NormalizedEvidencePhoto[] {
  const photos: NormalizedEvidencePhoto[] = [];
  for (const item of items) {
    if (item.url) {
      photos.push({ title: item.title, url: item.url, type: item.type || 'EVIDENCE' });
      continue;
    }
    if (item.beforeUrl) photos.push({ title: item.title, url: item.beforeUrl, type: 'BEFORE' });
    if (item.afterUrl) photos.push({ title: item.title, url: item.afterUrl, type: 'AFTER' });
  }
  return photos;
}
