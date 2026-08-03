import { createClient } from '@/lib/supabase/server';
import { getTenantContextOrNull } from '@/lib/tenant';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/reports/:id/download
 * Re-signs a fresh Storage URL for a generated report on demand.
 * The signed URL persisted on `generated_reports.file_url` at generation
 * time expires after 1 hour, so the report list must never rely on it
 * directly for reports older than that - it re-fetches through here instead.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: reportId } = await params;

  const tenant = await getTenantContextOrNull();
  if (!tenant) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();

  const { data: report, error: reportError } = await supabase
    .from('generated_reports')
    .select('id, file_path, company_id')
    .eq('id', reportId)
    .eq('company_id', tenant.companyId)
    .single();

  if (reportError || !report) {
    return NextResponse.json({ error: 'No se encontró el informe.' }, { status: 404 });
  }

  if (!report.file_path) {
    return NextResponse.json({ error: 'El informe no tiene un archivo asociado.' }, { status: 404 });
  }

  // Local dev fallback files (written when Storage upload failed) live under
  // /public/reports and are served as static assets, not through Storage.
  if (report.file_path.startsWith('/reports/')) {
    return NextResponse.json({ downloadUrl: report.file_path });
  }

  const { data: signed, error: signError } = await supabase.storage
    .from('reports')
    .createSignedUrl(report.file_path, 3600);

  if (signError || !signed?.signedUrl) {
    console.error('REPORT_DOWNLOAD_SIGN_ERROR', { reportId, message: signError?.message });
    return NextResponse.json({ error: 'No se pudo generar el enlace de descarga.' }, { status: 500 });
  }

  return NextResponse.json({ downloadUrl: signed.signedUrl });
}
