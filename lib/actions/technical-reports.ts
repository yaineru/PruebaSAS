'use server';

import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { createClient } from '@/lib/supabase/server';
import { getTenantContext } from '@/lib/tenant';
import { assertSameOrigin, assertRateLimit, sanitizeText } from '@/lib/security';
import { getEnumLabel } from '@/lib/enums';
import { generateTechnicalPdf } from '@/lib/reports/generators';
import { trackAnalyticsEvent } from '@/lib/actions/notifications';
import { formatDateTime } from '@/lib/utils';

export async function getMaintenanceTechnicalDetails(maintenanceId: string) {
  try {
    await assertSameOrigin();
    await assertRateLimit('getMaintenanceTechnicalDetails', 60);

    const tenant = await getTenantContext();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('maintenance_records')
      .select(
        'id, title, description, maintenance_date, due_date, type, status, cost, observations, evidence_before_url, evidence_after_url, responsible_name, asset_id, project_id, assets(name, code, location, brand, model, plate, status), projects(name, location), companies(name)'
      )
      .eq('id', maintenanceId)
      .eq('company_id', tenant.companyId)
      .single();

    if (error || !data) {
      return { success: false, error: 'No se encontró el mantenimiento seleccionado.' };
    }

    const assetData = (data as unknown as { assets?: unknown }).assets;
    const projectData = (data as unknown as { projects?: unknown }).projects;
    const companyData = (data as unknown as { companies?: unknown }).companies;

    const asset = Array.isArray(assetData)
      ? ((assetData as Array<Record<string, unknown>>)[0] ?? null)
      : ((assetData as Record<string, unknown> | null) ?? null);
    const project = Array.isArray(projectData)
      ? ((projectData as Array<Record<string, unknown>>)[0] ?? null)
      : ((projectData as Record<string, unknown> | null) ?? null);
    const company = Array.isArray(companyData)
      ? ((companyData as Array<Record<string, unknown>>)[0] ?? null)
      : ((companyData as Record<string, unknown> | null) ?? null);

    const assetStatus = typeof asset?.status === 'string' ? asset.status : undefined;
    const assetBrand = typeof asset?.brand === 'string' ? asset.brand : undefined;
    const assetModel = typeof asset?.model === 'string' ? asset.model : undefined;

    return {
      success: true,
      maintenance: {
        id: data.id,
        title: data.title,
        description: data.description,
        maintenanceDate: data.maintenance_date,
        dueDate: data.due_date,
        type: data.type,
        typeLabel: data.type ? getEnumLabel('maintenanceType', data.type) : undefined,
        status: data.status,
        cost: data.cost,
        observations: data.observations,
        evidenceBeforeUrl: data.evidence_before_url,
        evidenceAfterUrl: data.evidence_after_url,
        responsibleName: data.responsible_name,
        technicianName: data.responsible_name,
        assetId: data.asset_id,
        projectId: data.project_id,
        assetName: typeof asset?.name === 'string' ? asset.name : undefined,
        assetCode: typeof asset?.code === 'string' ? asset.code : undefined,
        assetLocation: typeof asset?.location === 'string' ? asset.location : undefined,
        assetBrand,
        assetModel,
        assetBrandModel: [assetBrand, assetModel].filter(Boolean).join(' ') || undefined,
        assetPlate: typeof asset?.plate === 'string' ? asset.plate : undefined,
        assetStatus,
        assetStatusLabel: assetStatus ? getEnumLabel('assetStatus', assetStatus) : undefined,
        projectName: typeof project?.name === 'string' ? project.name : undefined,
        projectLocation: typeof project?.location === 'string' ? project.location : undefined,
        companyName: typeof company?.name === 'string' ? company.name : undefined,
      },
    };
  } catch (error) {
    console.error('TECHNICAL_MAINTENANCE_PREFILL_ERROR', error);
    return { success: false, error: 'No fue posible cargar el mantenimiento.' };
  }
}

// Antes el tope se expresaba como "6 pares" (Antes+Después) = 12 fotos.
// Ahora cada foto es independiente (ver components/technical-report-form.tsx
// y lib/reports/generators.ts), así que el mismo tope real se expresa
// directamente en fotos individuales.
const MAX_EVIDENCE_ITEMS = 12;
const EVIDENCE_TYPES = new Set(['BEFORE', 'AFTER', 'EVIDENCE']);

type TechnicalReportEvidencePayload = Array<{ title?: string; url?: string | null; type: 'BEFORE' | 'AFTER' | 'EVIDENCE' }>;

type TechnicalReportBuild = {
  payload: ReturnType<typeof buildTechnicalReportPayload>;
  // Mismos campos que el formulario (components/technical-report-form.tsx
  // TEXT_FIELD_NAMES/SIGNATURE_FIELD_NAMES) - se guarda tal cual dentro de
  // report_metadata (jsonb, sin migración) para poder repoblar el formulario
  // si el usuario pide corregir el informe más tarde (ver updateTechnicalReport).
  formFieldsForEdit: Record<string, string>;
  evidenceItems: TechnicalReportEvidencePayload;
  pdfBuffer: Buffer;
  companyName: string;
  companySettings: { company_name?: string | null; logo_url?: string | null } | null;
};

function buildTechnicalReportPayload(formData: FormData) {
  const getText = (key: string, maxLength = 2000) => sanitizeText(formData.get(key) as string, maxLength);

  const activityTypeRaw = getText('activityType', 60);
  const equipmentStatusRaw = getText('equipmentStatus', 60);

  return {
    reportDate: getText('reportDate', 10) || new Date().toISOString().slice(0, 10),
    clientName: getText('clientName', 200),
    clientContact: getText('clientContact', 200),
    projectName: getText('projectName', 200),
    projectLocation: getText('projectLocation', 200),
    equipmentName: getText('equipment', 200),
    assetCode: getText('assetCode', 100),
    assetBrandModel: getText('assetBrandModel', 200),
    equipmentStatusRaw,
    equipmentStatusLabel: equipmentStatusRaw ? getEnumLabel('assetStatus', equipmentStatusRaw) : '',
    responsibleName: getText('responsibleName', 200),
    technicianName: getText('technicianName', 200),
    activityTypeRaw,
    activityTypeLabel: activityTypeRaw ? getEnumLabel('maintenanceType', activityTypeRaw) : '',
    problemDescription: getText('problemDescription'),
    procedure: getText('procedure'),
    sparePartsUsed: getText('sparePartsUsed'),
    observations: getText('observations'),
    technicalSignatureImage: (formData.get('technicalSignatureImage') as string) || '',
    technicalSignatureName: getText('technicalSignatureName', 200),
    technicalSignatureRole: getText('technicalSignatureRole', 120),
    technicalSignatureDate: getText('technicalSignatureDate', 10),
    clientSignatureImage: (formData.get('clientSignatureImage') as string) || '',
    clientSignatureName: getText('clientSignatureName', 200),
    clientSignatureRole: getText('clientSignatureRole', 120),
    clientSignatureDate: getText('clientSignatureDate', 10),
    maintenanceId: (formData.get('maintenanceId') as string) || '',
  };
}

async function buildTechnicalReportPdf(
  formData: FormData,
  tenant: Awaited<ReturnType<typeof getTenantContext>>,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ success: true; data: TechnicalReportBuild } | { success: false; error: string }> {
  const payload = buildTechnicalReportPayload(formData);

  if (!payload.clientName) {
    return { success: false, error: 'Indica el nombre del cliente.' };
  }
  if (!payload.problemDescription) {
    return { success: false, error: 'Describe el problema o motivo del servicio.' };
  }

  const evidenceCount = Math.min(
    Math.max(parseInt((formData.get('evidenceCount') as string) || '0', 10) || 0, 0),
    MAX_EVIDENCE_ITEMS
  );

  // Evidence photos are now uploaded straight from the browser to the
  // "reports" bucket (see components/technical-report-form.tsx) - only the
  // resulting signed URL travels through this Server Action. Raw File
  // objects used to arrive here and get written to the local filesystem,
  // which is read-only on Vercel and also had no expiry/auth on the served
  // URL; that upload path was removed entirely.
  //
  // Each photo is independent (no more forced Antes/Después pairing) - a
  // real case reported by a Progrúas user: many jobs don't have a
  // before/after as such, just several evidence photos of the work, the
  // part, the site, etc. `type` defaults to 'EVIDENCE' if missing/invalid
  // rather than rejecting the report, since this is display metadata, not
  // a security boundary.
  let evidenceItems: TechnicalReportEvidencePayload;
  try {
    evidenceItems = Array.from({ length: evidenceCount }, (_, index) => {
      const url = (formData.get(`evidenceUrl_${index}`) as string) || null;
      const title = sanitizeText(formData.get(`evidenceTitle_${index}`) as string, 150);
      const rawType = (formData.get(`evidenceType_${index}`) as string) || '';
      const type = (EVIDENCE_TYPES.has(rawType) ? rawType : 'EVIDENCE') as 'BEFORE' | 'AFTER' | 'EVIDENCE';

      return { title: title || undefined, url, type };
    });
  } catch (fileError) {
    return { success: false, error: fileError instanceof Error ? fileError.message : 'No fue posible procesar las imágenes.' };
  }

  const { data: companySettings } = await supabase
    .from('company_settings')
    .select('company_name, logo_url')
    .eq('company_id', tenant.companyId)
    .maybeSingle();

  const { data: companyRecord } = await supabase
    .from('companies')
    .select('phone, email, website')
    .eq('id', tenant.companyId)
    .maybeSingle();

  const companyName = companySettings?.company_name || tenant.companyName;
  const timestamp = new Date().toISOString();
  const reportCode = `INF-TEC-${timestamp.slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

  const pdfBuffer = await generateTechnicalPdf(
    {
      reportDate: payload.reportDate,
      clientName: payload.clientName,
      clientContact: payload.clientContact,
      projectName: payload.projectName,
      projectLocation: payload.projectLocation,
      equipmentName: payload.equipmentName,
      assetCode: payload.assetCode,
      assetBrandModel: payload.assetBrandModel,
      equipmentStatusLabel: payload.equipmentStatusLabel,
      responsibleName: payload.responsibleName,
      technicianName: payload.technicianName,
      activityTypeLabel: payload.activityTypeLabel,
      problemDescription: payload.problemDescription,
      procedure: payload.procedure,
      sparePartsUsed: payload.sparePartsUsed,
      observations: payload.observations,
      evidenceItems,
      technicalSignatureImage: payload.technicalSignatureImage || null,
      technicalSignatureName: payload.technicalSignatureName || payload.technicianName,
      technicalSignatureRole: payload.technicalSignatureRole,
      technicalSignatureDate: payload.technicalSignatureDate || payload.reportDate,
      clientSignatureImage: payload.clientSignatureImage || null,
      clientSignatureName: payload.clientSignatureName || payload.clientContact,
      clientSignatureRole: payload.clientSignatureRole,
      clientSignatureDate: payload.clientSignatureDate || payload.reportDate,
    },
    {
      companyName,
      companyLogoUrl: companySettings?.logo_url || undefined,
      companyPhone: companyRecord?.phone || undefined,
      companyEmail: companyRecord?.email || undefined,
      companyWebsite: companyRecord?.website || undefined,
      generatedDate: formatDateTime(new Date()),
      reportCode,
    }
  );

  const formFieldsForEdit: Record<string, string> = {
    reportDate: payload.reportDate,
    clientName: payload.clientName,
    clientContact: payload.clientContact,
    projectName: payload.projectName,
    projectLocation: payload.projectLocation,
    equipment: payload.equipmentName,
    assetCode: payload.assetCode,
    assetBrandModel: payload.assetBrandModel,
    equipmentStatus: payload.equipmentStatusRaw,
    responsibleName: payload.responsibleName,
    technicianName: payload.technicianName,
    activityType: payload.activityTypeRaw,
    problemDescription: payload.problemDescription,
    procedure: payload.procedure,
    sparePartsUsed: payload.sparePartsUsed,
    observations: payload.observations,
    technicalSignatureImage: payload.technicalSignatureImage,
    technicalSignatureName: payload.technicalSignatureName,
    technicalSignatureRole: payload.technicalSignatureRole,
    technicalSignatureDate: payload.technicalSignatureDate,
    clientSignatureImage: payload.clientSignatureImage,
    clientSignatureName: payload.clientSignatureName,
    clientSignatureRole: payload.clientSignatureRole,
    clientSignatureDate: payload.clientSignatureDate,
    maintenanceId: payload.maintenanceId,
  };

  return {
    success: true,
    data: { payload, formFieldsForEdit, evidenceItems, pdfBuffer, companyName, companySettings: companySettings ?? null },
  };
}

export async function generateTechnicalReport(formData: FormData) {
  let reportId: string | null = null;
  let reportSupabase: Awaited<ReturnType<typeof createClient>> | null = null;

  try {
    await assertSameOrigin();
    await assertRateLimit('generateTechnicalReport', 10);

    const tenant = await getTenantContext();
    const supabase = await createClient();
    reportSupabase = supabase;

    // Modo offline: el dispositivo genera este id una sola vez al guardar el
    // borrador y lo reenvía en cada reintento de sincronización. Si ya existe
    // un informe con este mismo (company_id, client_op_id) - ej. la conexión
    // se cortó justo después de que el intento anterior sí terminara de
    // generarse - se devuelve ese informe ya generado en vez de volver a
    // correr todo el pipeline (PDF + Storage) por segunda vez, que además de
    // costoso duplicaría el informe entregado al cliente.
    const clientOpIdRaw = formData.get('client_op_id');
    const clientOpId = clientOpIdRaw ? String(clientOpIdRaw) : undefined;
    if (clientOpId) {
      const { data: existing } = await supabase
        .from('generated_reports')
        .select('id, file_url, file_path')
        .eq('company_id', tenant.companyId)
        .eq('client_op_id', clientOpId)
        .maybeSingle();

      if (existing) {
        return {
          success: true,
          reportId: existing.id,
          downloadUrl: existing.file_url || existing.file_path || '',
          fileName: '',
          message: 'Informe técnico generado correctamente.',
        };
      }
    }

    const built = await buildTechnicalReportPdf(formData, tenant, supabase);
    if (!built.success) return built;
    const { payload, formFieldsForEdit, evidenceItems, pdfBuffer, companyName, companySettings } = built.data;

    const timestamp = new Date().toISOString();
    const fileName = `INFORME_TECNICO_${timestamp.slice(0, 10)}_${Date.now()}.pdf`;
    // Mismo formato de ruta que lib/actions/reports.ts: el companyId debe ser el primer
    // segmento porque la policy RLS de storage.objects lo exige.
    const storagePath = `${tenant.companyId}/technical/${fileName}`;
    const publicRelativePath = `/reports/${tenant.companyId}/technical/${fileName}`;
    const localStoragePath = path.join(process.cwd(), 'public', 'reports', tenant.companyId, 'technical', fileName);

    // Sube a Supabase Storage primero; si falla (bucket no disponible, red, etc.)
    // cae a un archivo local en /public como respaldo, igual que en reports.ts.
    let finalDownloadUrl = publicRelativePath;
    let uploadPath = storagePath;

    try {
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('reports')
        .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: false });

      if (uploadError || !uploadData) {
        throw uploadError || new Error('Storage upload unavailable');
      }

      uploadPath = uploadData.path;
      const { data: urlData, error: urlError } = await supabase.storage
        .from('reports')
        .createSignedUrl(storagePath, 3600);

      if (urlError || !urlData?.signedUrl) {
        throw urlError || new Error('No se pudo firmar la URL del informe técnico.');
      }

      finalDownloadUrl = urlData.signedUrl;
    } catch (storageError) {
      console.warn('TECHNICAL_REPORT_STORAGE_FALLBACK', {
        error: storageError instanceof Error ? storageError.message : String(storageError),
      });

      // Vercel serverless functions have a read-only filesystem (no /public writes
      // persist or are servable across invocations) - only fall back to local disk
      // in local development, otherwise surface the Storage failure as a hard error.
      if (process.env.VERCEL) {
        throw storageError instanceof Error ? storageError : new Error('Storage upload unavailable');
      }

      await mkdir(path.dirname(localStoragePath), { recursive: true });
      await writeFile(localStoragePath, pdfBuffer);
      finalDownloadUrl = publicRelativePath;
      uploadPath = storagePath;
    }

    const reportMetadata = {
      clientName: payload.clientName,
      clientContact: payload.clientContact,
      projectName: payload.projectName,
      equipmentName: payload.equipmentName,
      responsibleName: payload.responsibleName,
      technicianName: payload.technicianName,
      // Guarda todos los campos del formulario (jsonb, sin migración) para
      // poder repoblarlo si el usuario pide corregir el informe más tarde -
      // ver updateTechnicalReport y el modo edición en TechnicalReportForm.
      formPayload: formFieldsForEdit,
    };
    const signatures = [
      { label: 'Firma de entrega', name: payload.technicalSignatureName || payload.technicianName || undefined },
      { label: 'Firma de recibido', name: payload.clientSignatureName || payload.clientContact || undefined },
    ];

    const generatedReportsInsertPayload = {
      company_id: tenant.companyId,
      client_op_id: clientOpId || null,
      report_type: 'TECHNICAL_REPORT',
      report_entity: 'TECHNICAL',
      report_format: 'PDF',
      file_format: 'PDF',
      template_name: 'technical_client',
      record_count: 1,
      row_count: 1,
      file_path: uploadPath,
      generated_by: tenant.userId,
      status: 'GENERATING',
      filters: { maintenanceId: payload.maintenanceId, clientName: payload.clientName },
      filters_applied: { maintenanceId: payload.maintenanceId, clientName: payload.clientName },
      file_size_bytes: pdfBuffer.length,
      file_url: finalDownloadUrl,
      report_metadata: reportMetadata,
      evidence_items: evidenceItems,
      signatures,
      generation_time_ms: null,
      error_message: null,
    };

    const { data: report, error: reportInsertError } = await supabase
      .from('generated_reports')
      .insert(generatedReportsInsertPayload as Record<string, unknown>)
      .select()
      .single();

    if (reportInsertError?.code === '23505' && clientOpId && reportInsertError.message.includes('client_op_key')) {
      // Carrera real entre dos intentos de sincronización concurrentes (ej.
      // dos pestañas, o un reintento que arrancó justo antes de que el
      // primero terminara) - el chequeo previo no la vio porque el otro
      // intento todavía no había insertado. El PDF ya generado en este
      // intento se descarta (nunca llegó a insertarse), se devuelve el que sí
      // ganó la carrera.
      const { data: existing } = await supabase
        .from('generated_reports')
        .select('id, file_url, file_path')
        .eq('company_id', tenant.companyId)
        .eq('client_op_id', clientOpId)
        .maybeSingle();

      if (existing) {
        return {
          success: true,
          reportId: existing.id,
          downloadUrl: existing.file_url || existing.file_path || '',
          fileName: '',
          message: 'Informe técnico generado correctamente.',
        };
      }
    }

    if (reportInsertError || !report) {
      console.error('GENERATED_REPORTS_INSERT_ERROR', {
        code: reportInsertError?.code,
        message: reportInsertError?.message,
        details: reportInsertError?.details,
      });
      throw new Error(reportInsertError?.message || 'No fue posible registrar el informe técnico.');
    }

    reportId = report.id;

    const { error: readyError } = await supabase
      .from('generated_reports')
      .update({
        file_url: finalDownloadUrl,
        file_path: uploadPath,
        file_size_bytes: pdfBuffer.length,
        status: 'READY',
      })
      .eq('id', report.id);

    if (readyError) {
      // Previously this result was never checked: the function returned
      // success:true even when this update failed, leaving the row stuck at
      // GENERATING forever while telling the user everything worked.
      throw new Error('No fue posible finalizar el registro del informe técnico.');
    }

    // The status transition to READY is already captured by the
    // audit_generated_reports trigger (write_audit_log(), see
    // 004_reports_evidence.sql) - no separate audit_logs insert needed here.
    // (It previously used an invalid audit_action enum value,
    // 'GENERATE_TECHNICAL_REPORT', which failed on every call.)

    await trackAnalyticsEvent('GENERATE_TECHNICAL_REPORT');

    const { data: notifyProfile } = await supabase.from('users').select('email').eq('id', tenant.userId).maybeSingle();
    if (notifyProfile?.email) {
      const { data: subscription } = await supabase
        .from('email_subscriptions')
        .select('enabled, frequency')
        .eq('company_id', tenant.companyId)
        .eq('user_id', tenant.userId)
        .eq('event_type', 'REPORT_GENERATED')
        .maybeSingle();

      if (subscription?.enabled && subscription.frequency === 'IMMEDIATE') {
        const { technicalReportGeneratedEmail } = await import('@/lib/email/templates');
        const { enqueueEmail } = await import('@/lib/email/mailer');
        const { subject, html } = technicalReportGeneratedEmail(
          { companyName, primaryColor: '#0f172a', logoUrl: companySettings?.logo_url || null },
          { clientName: payload.clientName, downloadUrl: finalDownloadUrl }
        );
        await enqueueEmail({
          companyId: tenant.companyId,
          to: notifyProfile.email,
          subject,
          html,
          templateKey: 'technical_report_generated',
          createdBy: tenant.userId,
        });
      }
    }

    return {
      success: true,
      reportId: report.id,
      downloadUrl: publicRelativePath,
      fileName,
      message: 'Informe técnico generado correctamente.',
    };
  } catch (error) {
    console.error('TECHNICAL_REPORT_GENERATION_ERROR', error);

    if (reportId && reportSupabase) {
      await reportSupabase
        .from('generated_reports')
        .update({ status: 'FAILED', error_message: 'No fue posible generar el informe técnico.' })
        .eq('id', reportId)
        .then(null, () => undefined);
    }

    // Never surface the raw error (Postgres/Storage/filesystem message) to
    // the end user - matches the fix already applied to the managerial
    // report flow in lib/actions/reports.ts.
    return {
      success: false,
      error: 'No fue posible generar el informe técnico. Intenta de nuevo.',
    };
  }
}

/**
 * Carga los datos de un informe técnico ya generado para repoblar el
 * formulario cuando el usuario pide corregirlo (ver formPayload guardado en
 * report_metadata dentro de generateTechnicalReport/updateTechnicalReport).
 */
export async function getTechnicalReportForEdit(reportId: string) {
  try {
    await assertSameOrigin();
    await assertRateLimit('getTechnicalReportForEdit', 60);

    const tenant = await getTenantContext();
    const supabase = await createClient();

    const { data: report, error } = await supabase
      .from('generated_reports')
      .select('id, report_type, report_metadata, evidence_items')
      .eq('id', reportId)
      .eq('company_id', tenant.companyId)
      .maybeSingle();

    if (error || !report || report.report_type !== 'TECHNICAL_REPORT') {
      return { success: false, error: 'No se encontró el informe técnico a corregir.' };
    }

    const metadata = (report.report_metadata || {}) as Record<string, unknown>;
    const formPayload = (metadata.formPayload || {}) as Record<string, string>;
    const evidenceItems = (report.evidence_items || []) as Array<{ title?: string; url?: string | null; type?: string }>;

    return { success: true, formPayload, evidenceItems };
  } catch (error) {
    console.error('TECHNICAL_REPORT_LOAD_FOR_EDIT_ERROR', error);
    return { success: false, error: 'No fue posible cargar el informe técnico.' };
  }
}

/**
 * Corrige un informe técnico ya generado: vuelve a construir el PDF con los
 * datos editados y reemplaza el archivo y los metadatos del mismo registro en
 * generated_reports (misma fila, nuevo archivo en Storage) en vez de crear un
 * informe nuevo - así el historial no se llena de duplicados por cada
 * corrección y el enlace ya compartido con el cliente puede re-descargarse
 * corregido.
 */
export async function updateTechnicalReport(reportId: string, formData: FormData) {
  try {
    await assertSameOrigin();
    await assertRateLimit('updateTechnicalReport', 10);

    const tenant = await getTenantContext();
    const supabase = await createClient();

    const { data: existing, error: fetchError } = await supabase
      .from('generated_reports')
      .select('id, file_path, report_type')
      .eq('id', reportId)
      .eq('company_id', tenant.companyId)
      .maybeSingle();

    if (fetchError || !existing) {
      return { success: false, error: 'No se encontró el informe técnico a corregir.' };
    }
    if (existing.report_type !== 'TECHNICAL_REPORT') {
      return { success: false, error: 'Este informe no se puede corregir.' };
    }

    const built = await buildTechnicalReportPdf(formData, tenant, supabase);
    if (!built.success) return built;
    const { payload, formFieldsForEdit, evidenceItems, pdfBuffer } = built.data;

    const timestamp = new Date().toISOString();
    const fileName = `INFORME_TECNICO_${timestamp.slice(0, 10)}_${Date.now()}.pdf`;
    const storagePath = `${tenant.companyId}/technical/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('reports')
      .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: false });

    if (uploadError || !uploadData) {
      console.error('TECHNICAL_REPORT_UPDATE_STORAGE_ERROR', uploadError);
      return { success: false, error: 'No fue posible guardar el PDF corregido.' };
    }

    const { data: urlData, error: urlError } = await supabase.storage
      .from('reports')
      .createSignedUrl(storagePath, 3600);

    if (urlError || !urlData?.signedUrl) {
      return { success: false, error: 'No se pudo generar el enlace del informe corregido.' };
    }

    const reportMetadata = {
      clientName: payload.clientName,
      clientContact: payload.clientContact,
      projectName: payload.projectName,
      equipmentName: payload.equipmentName,
      responsibleName: payload.responsibleName,
      technicianName: payload.technicianName,
      formPayload: formFieldsForEdit,
    };
    const signatures = [
      { label: 'Firma de entrega', name: payload.technicalSignatureName || payload.technicianName || undefined },
      { label: 'Firma de recibido', name: payload.clientSignatureName || payload.clientContact || undefined },
    ];

    const { error: updateError } = await supabase
      .from('generated_reports')
      .update({
        file_path: uploadData.path,
        file_url: urlData.signedUrl,
        file_size_bytes: pdfBuffer.length,
        status: 'READY',
        error_message: null,
        report_metadata: reportMetadata,
        evidence_items: evidenceItems,
        signatures,
        filters: { maintenanceId: payload.maintenanceId, clientName: payload.clientName },
        filters_applied: { maintenanceId: payload.maintenanceId, clientName: payload.clientName },
      })
      .eq('id', reportId);

    if (updateError) {
      console.error('TECHNICAL_REPORT_UPDATE_ERROR', updateError);
      // El PDF corregido ya quedó subido con un nombre nuevo - se limpia para
      // no dejar un archivo huérfano si la fila no se pudo actualizar.
      await supabase.storage.from('reports').remove([uploadData.path]).then(null, () => undefined);
      return { success: false, error: 'No fue posible actualizar el informe técnico.' };
    }

    // Mejor esfuerzo: borra el PDF anterior ahora que el nuevo ya quedó
    // registrado - si falla, el archivo viejo queda huérfano en Storage pero
    // ya no afecta nada (ninguna fila lo referencia).
    if (existing.file_path && existing.file_path !== uploadData.path) {
      await supabase.storage.from('reports').remove([existing.file_path]).then(null, () => undefined);
    }

    await trackAnalyticsEvent('UPDATE_TECHNICAL_REPORT');

    return {
      success: true,
      reportId,
      downloadUrl: urlData.signedUrl,
      message: 'Informe técnico corregido correctamente.',
    };
  } catch (error) {
    console.error('TECHNICAL_REPORT_UPDATE_UNEXPECTED_ERROR', error);
    return {
      success: false,
      error: 'No fue posible corregir el informe técnico. Intenta de nuevo.',
    };
  }
}
