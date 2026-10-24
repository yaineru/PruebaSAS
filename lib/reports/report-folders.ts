// Lógica pura de clasificación y agrupación para "informes por carpetas"
// (Proyecto -> Año -> Mes -> Informes). Sin I/O a propósito: toda esta
// lógica se puede probar con arreglos sintéticos, sin tocar Supabase - la
// obtención de datos (lib/actions/report-folders.ts) es una capa delgada
// que llama a estas funciones.

export const MONTH_NAMES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
] as const;

export type YearMonth = { year: number; month: number }; // month: 1-12

/**
 * Para valores de solo fecha ("YYYY-MM-DD", como formPayload.reportDate de
 * un informe técnico): nunca pasa por `new Date(string)`. Esa función
 * interpreta "2026-01-31" como medianoche UTC, y en cualquier zona detrás de
 * UTC (Bogotá es UTC-5) el día calendario mostrado retrocede un día - el
 * mismo bug que ya existía y se corrigió una vez para formatDate() en
 * lib/utils.ts. Leer año/mes directamente de los dígitos del string evita
 * esa clase de error por completo, sin importar la zona horaria del
 * servidor que ejecuta este código.
 */
export function yearMonthFromDateOnly(value: string | null | undefined): YearMonth | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

/**
 * Para timestamps reales (timestamptz, ej. created_at): a diferencia de un
 * valor de solo fecha, aquí SÍ hay que convertir de zona horaria - pero a la
 * zona en la que el resto de la aplicación muestra fechas (America/Bogota,
 * ver lib/utils.ts), no UTC. Un informe creado el 31 de enero a las 23:30
 * hora de Bogotá ya es 1 de febrero en UTC; agrupar por los componentes UTC
 * lo pondría en la carpeta equivocada.
 */
export function yearMonthFromTimestamp(value: string | null | undefined): YearMonth | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "numeric",
  }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  if (!year || !month) return null;
  return { year, month };
}

export type FolderReportInput = {
  id: string;
  reportType: string;
  createdAt: string;
  projectId: string | null;
  // Para TECHNICAL_REPORT: report_metadata.formPayload.reportDate (fecha de
  // ejecución/del informe, ya existente en el modelo - NO created_at).
  reportDate: string | null;
  // Reclasificación manual (generated_reports.folder_year/folder_month,
  // migración 046) - cuando ambos están presentes, GANAN sobre reportDate/
  // created_at para decidir año y mes, sin tocar la fecha real del informe
  // ni su contenido. Nunca afecta la categoría (project/unassigned/general),
  // solo en qué Año/Mes aparece dentro de esa categoría.
  folderYear: number | null;
  folderMonth: number | null;
};

export type FolderCategory = "project" | "unassigned_technical" | "general";

export type ClassifiedReport = FolderReportInput & {
  category: FolderCategory;
  bucket: YearMonth | null;
};

/**
 * Regla de clasificación (ver auditoría): un informe técnico con project_id
 * real (FK validada server-side, nunca el texto libre projectName) va a la
 * carpeta de ese proyecto. Un informe técnico sin project_id va a "Sin
 * proyecto asignado" - nunca se asigna automáticamente por coincidencia de
 * nombre. Cualquier otro tipo de informe (exportaciones generales: ASSETS,
 * MAINTENANCE, INCIDENTS, PROJECTS, DOCUMENTS) es de toda la empresa, nunca
 * de un proyecto particular, y va a "Informes generales".
 *
 * La fecha que determina la carpeta también depende del tipo: los informes
 * técnicos usan su propia reportDate (fecha de ejecución) cuando existe;
 * las exportaciones generales usan created_at, que es el único dato de
 * fecha que esas filas tienen - igual que ya se ordenaban en el historial
 * plano existente (components/report-list.tsx), así que esto no cambia su
 * comportamiento previo, solo lo usa también para agrupar.
 */
export function classifyReport(report: FolderReportInput): ClassifiedReport {
  const manualBucket: YearMonth | null =
    report.folderYear != null && report.folderMonth != null
      ? { year: report.folderYear, month: report.folderMonth }
      : null;

  if (report.reportType === "TECHNICAL_REPORT") {
    const bucket = manualBucket ?? yearMonthFromDateOnly(report.reportDate) ?? yearMonthFromTimestamp(report.createdAt);
    return {
      ...report,
      category: report.projectId ? "project" : "unassigned_technical",
      bucket,
    };
  }
  return { ...report, category: "general", bucket: manualBucket ?? yearMonthFromTimestamp(report.createdAt) };
}

export type ProjectFolder = {
  projectId: string;
  projectName: string;
  years: Map<number, Map<number, ClassifiedReport[]>>;
  count: number;
};

export type ReportFolderTree = {
  projects: ProjectFolder[];
  unassignedTechnical: { years: Map<number, Map<number, ClassifiedReport[]>>; count: number };
  general: { years: Map<number, Map<number, ClassifiedReport[]>>; count: number };
  totalCount: number;
};

function addToYearMonth(
  target: Map<number, Map<number, ClassifiedReport[]>>,
  report: ClassifiedReport
) {
  if (!report.bucket) return;
  const { year, month } = report.bucket;
  if (!target.has(year)) target.set(year, new Map());
  const months = target.get(year)!;
  if (!months.has(month)) months.set(month, []);
  months.get(month)!.push(report);
}

/**
 * Construye el árbol completo a partir de filas ya obtenidas (una sola
 * consulta, ver lib/actions/report-folders.ts) y un mapa de nombres de
 * proyecto YA resuelto y filtrado por empresa - esta función nunca decide
 * qué proyectos existen, solo organiza lo que se le pasa. Cada informe
 * aparece exactamente una vez (clasificado en project, unassigned_technical
 * o general - las tres ramas son mutuamente excluyentes por construcción),
 * así que no hay forma de que un informe se duplique o se pierda al
 * recorrer el árbol resultante.
 */
export function buildReportFolderTree(
  reports: FolderReportInput[],
  projectNames: Map<string, string>
): ReportFolderTree {
  const classified = reports.map(classifyReport);

  const projectBuckets = new Map<string, ProjectFolder>();
  const unassignedTechnical: ReportFolderTree["unassignedTechnical"] = { years: new Map(), count: 0 };
  const general: ReportFolderTree["general"] = { years: new Map(), count: 0 };

  for (const report of classified) {
    if (report.category === "project" && report.projectId) {
      if (!projectBuckets.has(report.projectId)) {
        projectBuckets.set(report.projectId, {
          projectId: report.projectId,
          projectName: projectNames.get(report.projectId) ?? "Proyecto",
          years: new Map(),
          count: 0,
        });
      }
      const bucket = projectBuckets.get(report.projectId)!;
      addToYearMonth(bucket.years, report);
      bucket.count += 1;
    } else if (report.category === "unassigned_technical") {
      addToYearMonth(unassignedTechnical.years, report);
      unassignedTechnical.count += 1;
    } else {
      addToYearMonth(general.years, report);
      general.count += 1;
    }
  }

  const projects = Array.from(projectBuckets.values()).sort((a, b) =>
    a.projectName.localeCompare(b.projectName, "es")
  );

  return {
    projects,
    unassignedTechnical,
    general,
    totalCount: classified.length,
  };
}
