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

// Causa raíz confirmada de "las fotografías desaparecen después de guardar"
// (components/technical-report-form.tsx): EvidencePicker sube cada foto a
// Storage de forma asíncrona (fetch + createSignedUrl), y su resultado solo
// llega al estado del formulario padre cuando esa subida TERMINA
// (onUploaded/onLocalFile). Mientras tanto, la vista previa ya se muestra
// (un blob: URL local, instantáneo) aunque el campo url del padre siga
// vacío. Si el usuario pulsa "Generar informe técnico" en esa ventana - más
// probable con conexión lenta/inestable, justo el escenario reportado -, el
// filtro que decide qué fotos viajar las excluía en silencio: ni error, ni
// aviso, el informe se guardaba con menos fotos (o ninguna) de las que el
// usuario veía en pantalla. El fix real es bloquear el envío mientras haya
// una subida en curso (ver anyPhotoUploading en el componente); esta función
// expone esa misma regla en forma pura, para poder probarla sin React/DOM.
export type EvidencePhotoSubmissionState = {
  url: string;
  pendingLocal?: boolean;
  uploading?: boolean;
};

export function hasPendingEvidenceUploads(photos: EvidencePhotoSubmissionState[]): boolean {
  return photos.some((photo) => photo.uploading);
}

// Misma regla que ya usaba el envío: una fila agregada pero sin imagen
// (nunca se seleccionó archivo, o la subida falló y se limpió el preview) no
// debe generar un item de evidencia vacío. No decide si es seguro enviar -
// eso es hasPendingEvidenceUploads(); esto solo decide QUÉ fotos viajan una
// vez que sí es seguro hacerlo.
export function selectEvidencePhotosToSubmit<T extends EvidencePhotoSubmissionState>(photos: T[]): T[] {
  return photos.filter((photo) => photo.url || photo.pendingLocal);
}
