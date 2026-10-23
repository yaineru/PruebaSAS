'use server';

import { createClient } from '@/lib/supabase/server';
import { getTenantContext } from '@/lib/tenant';
import { assertSameOrigin, assertRateLimit } from '@/lib/security';
import { buildReportFolderTree, type FolderReportInput } from '@/lib/reports/report-folders';

export type SerializedReportEntry = {
  id: string;
  reportType: string;
  reportFormat: string;
  status: string;
  createdAt: string;
  reportDate: string | null;
  fileSizeBytes: number | null;
  recordCount: number;
  // Igual que canCorrect() en components/report-list.tsx: solo true para
  // informes técnicos que guardaron el formulario completo (desde que
  // existe "Corregir") - nunca se envía el report_metadata completo al
  // cliente solo para decidir si mostrar un botón.
  canCorrect: boolean;
};

export type SerializedYearMonth = { year: number; month: number; reports: SerializedReportEntry[] };
export type SerializedProjectFolder = { projectId: string; projectName: string; count: number; buckets: SerializedYearMonth[] };
export type SerializedBucketGroup = { count: number; buckets: SerializedYearMonth[] };

export type ReportFoldersResult =
  | {
      success: true;
      data: {
        projects: SerializedProjectFolder[];
        unassignedTechnical: SerializedBucketGroup;
        general: SerializedBucketGroup;
        totalCount: number;
      };
    }
  | { success: false; error: string };

function toEntry(row: {
  id: string;
  report_type: string;
  report_format: string | null;
  status: string | null;
  created_at: string;
  file_size_bytes: number | null;
  record_count: number | null;
  report_metadata: unknown;
}): SerializedReportEntry {
  const metadata = (row.report_metadata || {}) as Record<string, unknown>;
  const formPayload = (metadata.formPayload || {}) as Record<string, unknown>;
  return {
    id: row.id,
    reportType: row.report_type,
    reportFormat: row.report_format ?? 'PDF',
    status: row.status ?? 'GENERATED',
    createdAt: row.created_at,
    reportDate: null, // se completa aparte, ver abajo
    fileSizeBytes: row.file_size_bytes,
    recordCount: row.record_count ?? 0,
    canCorrect: row.report_type === 'TECHNICAL_REPORT' && Object.keys(formPayload).length > 0,
  };
}

/**
 * Obtiene y clasifica los informes de la empresa actual para la vista de
 * carpetas (Proyecto -> Año -> Mes -> Informes). Todo el filtrado por
 * empresa ocurre aquí, en el servidor, con tenant.companyId resuelto desde
 * la sesión autenticada (getTenantContext) - nunca con un company_id ni
 * project_id recibido del cliente. RLS (generated_reports_select /
 * projects_select, ambas is_company_member()) es una segunda capa, no la
 * única: esta consulta nunca se construye a partir de parámetros de entrada
 * sin validar.
 *
 * Una sola consulta a generated_reports y una sola a projects (para
 * resolver nombres), sin importar cuántas carpetas resulten - no hay una
 * consulta por carpeta, así que esto no se degrada con el volumen de
 * proyectos o meses.
 */
export async function getReportFolders(): Promise<ReportFoldersResult> {
  try {
    await assertSameOrigin();
    await assertRateLimit('getReportFolders', 60);

    const tenant = await getTenantContext();
    const supabase = await createClient();

    const { data: rows, error } = await supabase
      .from('generated_reports')
      .select('id, report_type, report_format, status, created_at, file_size_bytes, record_count, project_id, report_metadata')
      .eq('company_id', tenant.companyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('GET_REPORT_FOLDERS_ERROR', error);
      return { success: false, error: 'No fue posible cargar los informes.' };
    }

    const projectIds = Array.from(
      new Set((rows ?? []).map((r) => r.project_id).filter((id): id is string => Boolean(id)))
    );

    let projectNames = new Map<string, string>();
    if (projectIds.length > 0) {
      // Segundo filtro explícito por company_id además de RLS: un project_id
      // ajeno guardado en una fila (que ya no debería poder pasar la
      // validación en technical-reports.ts, pero esta consulta no confía en
      // eso) simplemente no resuelve nombre aquí y el informe queda sin
      // nombre de proyecto visible, nunca con el nombre real de otra
      // empresa.
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id, name')
        .eq('company_id', tenant.companyId)
        .in('id', projectIds);
      if (projectsError) {
        console.error('GET_REPORT_FOLDERS_PROJECTS_ERROR', projectsError);
      } else {
        projectNames = new Map((projects ?? []).map((p) => [p.id as string, p.name as string]));
      }
    }

    const folderInputs: FolderReportInput[] = (rows ?? []).map((row) => {
      const metadata = (row.report_metadata || {}) as Record<string, unknown>;
      const formPayload = (metadata.formPayload || {}) as Record<string, unknown>;
      const reportDate = row.report_type === 'TECHNICAL_REPORT' && typeof formPayload.reportDate === 'string'
        ? formPayload.reportDate
        : null;
      return {
        id: row.id as string,
        reportType: row.report_type as string,
        createdAt: row.created_at as string,
        // Un project_id que no resolvió nombre (ajeno o huérfano) se trata
        // como si no tuviera proyecto - nunca se muestra una carpeta sin
        // nombre verificado.
        projectId: row.project_id && projectNames.has(row.project_id as string) ? (row.project_id as string) : null,
        reportDate,
      };
    });

    const tree = buildReportFolderTree(folderInputs, projectNames);

    const entryById = new Map(
      (rows ?? []).map((row) => [
        row.id as string,
        toEntry(row as Parameters<typeof toEntry>[0]),
      ])
    );
    // El bucketing usa reportDate internamente; para la respuesta serializada
    // se expone igual, tomado del mismo formPayload ya leído arriba.
    for (const input of folderInputs) {
      const entry = entryById.get(input.id);
      if (entry) entry.reportDate = input.reportDate;
    }

    const serializeYears = (years: Map<number, Map<number, { id: string }[]>>): SerializedYearMonth[] => {
      const result: SerializedYearMonth[] = [];
      for (const [year, months] of years) {
        for (const [month, reports] of months) {
          result.push({
            year,
            month,
            reports: reports
              .map((r) => entryById.get(r.id))
              .filter((e): e is SerializedReportEntry => Boolean(e))
              .sort((a, b) => (a.reportDate ?? a.createdAt).localeCompare(b.reportDate ?? b.createdAt) * -1),
          });
        }
      }
      // Año/mes descendente: lo más reciente primero, igual que el historial
      // plano existente (order created_at desc).
      result.sort((a, b) => (b.year - a.year) || (b.month - a.month));
      return result;
    };

    return {
      success: true,
      data: {
        projects: tree.projects.map((p) => ({
          projectId: p.projectId,
          projectName: p.projectName,
          count: p.count,
          buckets: serializeYears(p.years),
        })),
        unassignedTechnical: {
          count: tree.unassignedTechnical.count,
          buckets: serializeYears(tree.unassignedTechnical.years),
        },
        general: {
          count: tree.general.count,
          buckets: serializeYears(tree.general.years),
        },
        totalCount: tree.totalCount,
      },
    };
  } catch (error) {
    console.error('GET_REPORT_FOLDERS_UNEXPECTED_ERROR', error);
    return { success: false, error: 'No fue posible cargar los informes.' };
  }
}
