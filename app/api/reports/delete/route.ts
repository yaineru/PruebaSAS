import { createClient } from '@/lib/supabase/server';
import { getTenantContextOrNull } from '@/lib/tenant';
import { NextRequest, NextResponse } from 'next/server';
import { unlink } from 'fs/promises';
import path from 'path';

/**
 * POST /api/reports/delete
 * Delete a generated report (DB record + underlying file when present).
 * The frontend (components/report-list.tsx) already calls this endpoint,
 * but it did not exist yet - every delete attempt failed with a 404.
 */
export async function POST(request: NextRequest) {
  try {
    const tenant = await getTenantContextOrNull();

    if (!tenant) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { companyId } = tenant;
    const body = await request.json().catch(() => null);
    const reportId = body?.reportId as string | undefined;

    if (!reportId) {
      return NextResponse.json({ error: 'Falta el identificador del informe.' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: report, error: reportError } = await supabase
      .from('generated_reports')
      .select('id, file_path, company_id')
      .eq('id', reportId)
      .eq('company_id', companyId)
      .single();

    if (reportError || !report) {
      return NextResponse.json({ error: 'No se encontró el informe.' }, { status: 404 });
    }

    if (report.file_path) {
      const { error: storageError } = await supabase.storage.from('reports').remove([report.file_path]);
      if (storageError) {
        console.warn('REPORT_DELETE_STORAGE_WARNING', { reportId, message: storageError.message });
      }

      // Informes generados antes de esta corrección (o cuando Storage no estuvo disponible)
      // quedaron guardados solo en disco local; intenta borrarlos también.
      const localPath = path.join(process.cwd(), 'public', 'reports', report.file_path);
      try {
        await unlink(localPath);
      } catch (fsError) {
        const err = fsError as NodeJS.ErrnoException;
        if (err?.code !== 'ENOENT') {
          console.warn('REPORT_DELETE_LOCAL_FILE_WARNING', { reportId, message: err?.message });
        }
      }
    }

    const { error: deleteError } = await supabase
      .from('generated_reports')
      .delete()
      .eq('id', reportId)
      .eq('company_id', companyId);

    if (deleteError) {
      console.error('REPORT_DELETE_ERROR', { reportId, message: deleteError.message });
      return NextResponse.json({ error: 'No se pudo eliminar el informe.' }, { status: 500 });
    }

    // The DELETE above is already captured by the audit_generated_reports
    // trigger (write_audit_log(), see 004_reports_evidence.sql) - no separate
    // audit_logs insert needed here.

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/reports/delete error:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
