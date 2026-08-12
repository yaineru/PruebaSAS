'use server';

import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { createClient } from '@/lib/supabase/server';
import { getTenantContext } from '@/lib/tenant';
import { assertSameOrigin, assertRateLimit, sanitizeText } from '@/lib/security';
import {
  generateReportSchema,
  reportScheduleSchema,
  reportTemplateSchema,
} from '@/lib/reports/report-schema';
import { REPORT_COLUMN_TEMPLATES, type ReportEntityKey } from '@/lib/reports/column-templates';
import { REPORT_ENTITY_LABELS } from '@/lib/reports/entity-labels';
import { trackAnalyticsEvent } from '@/lib/actions/notifications';
import { formatDateTime } from '@/lib/utils';
import { z, ZodError } from 'zod';

/**
 * Generate Report
 * Main action to generate PDF/Excel reports with file generation and upload
 * 
 * Flow:
 * 1. Validate and fetch data
 * 2. Create initial report record (status: GENERATING)
 * 3. Generate PDF/Excel file
 * 4. Upload to Supabase Storage
 * 5. Create signed URL
 * 6. Update report with file_url
 * 7. Change status to GENERATED
 */
export async function generateReport(formData: FormData) {
  const startTime = Date.now();
  let reportId: string | undefined;

  try {
    await assertSameOrigin();
    await assertRateLimit('generateReport', 10);

    const { companyId, userId } = await getTenantContext();

    // Extract form data
    const reportEntity = sanitizeText(formData.get('reportEntity') as string);
    const reportFormat = formData.get('reportFormat') as string;
    const templateName = sanitizeText(formData.get('templateName') as string || 'standard');
    const templateId = sanitizeText(formData.get('templateId') as string || '') || null;

    // Parse filters from form
    const filters: Record<string, string> = {};
    const formEntries = Array.from(formData.entries());
    for (const [key, value] of formEntries) {
      if (key.startsWith('filter_')) {
        const filterKey = key.replace('filter_', '');
        filters[filterKey] = String(value);
      }
    }

    // Validate
    const payload = {
      reportEntity,
      reportFormat,
      templateName,
      filters,
    };
    console.log('REPORT_PAYLOAD', JSON.stringify(payload, null, 2));

    const validated = generateReportSchema.parse(payload);

    const supabase = await createClient();

    // Get company info
    const { data: company } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', companyId)
      .single();

    const { data: companySettings } = await supabase
      .from('company_settings')
      .select('logo_url, company_name, primary_color')
      .eq('company_id', companyId)
      .maybeSingle();

    const { data: currentUserProfile } = await supabase
      .from('users')
      .select('full_name, email')
      .eq('id', userId)
      .maybeSingle();

    if (!company) {
      return { success: false, error: 'No se encontró la empresa.' };
    }

    // Plantilla personalizada seleccionada (si aplica): antes de este fix el
    // selector de plantillas ni siquiera existía en el formulario, así que
    // esto nunca se leía y ninguna plantilla afectaba el PDF/Excel generado.
    let selectedTemplate: { color_scheme: string | null; include_logo: boolean | null } | null = null;
    if (templateId) {
      const { data: templateRow } = await supabase
        .from('report_templates')
        .select('color_scheme, include_logo')
        .eq('id', templateId)
        .eq('company_id', companyId)
        .maybeSingle();
      selectedTemplate = templateRow;
    }

    // Fetch data based on entity type
    let data: Record<string, unknown>[] = [];
    let recordCount = 0;

    const ENTITY_TABLES: Record<ReportEntityKey, string> = {
      ASSETS: 'assets',
      INCIDENTS: 'incidents',
      MAINTENANCE: 'maintenance_records',
      PROJECTS: 'projects',
      DOCUMENTS: 'asset_documents',
    };

    const entityTemplate = REPORT_COLUMN_TEMPLATES[validated.reportEntity as ReportEntityKey];
    const entityTable = ENTITY_TABLES[validated.reportEntity as ReportEntityKey];

    if (!entityTemplate || !entityTable) {
      return { success: false, error: 'Entidad de informe no válida.' };
    }

    // El formulario (AdvancedFilters) siempre enviaba estos valores, pero antes de
    // este fix nunca se aplicaban a la consulta: la sección "Filtros avanzados" no
    // filtraba nada en el informe generado. Cada entidad soporta un subconjunto
    // distinto de filtros, según sus columnas reales.
    let assetIdsForProject: string[] | null = null;
    if (validated.reportEntity === 'ASSETS' && filters.projectId) {
      const { data: assignmentRows } = await supabase
        .from('asset_assignments')
        .select('asset_id')
        .eq('company_id', companyId)
        .eq('project_id', filters.projectId);
      assetIdsForProject = (assignmentRows || []).map((row) => row.asset_id).filter(Boolean);
    }

    let entityQuery = supabase
      .from(entityTable)
      .select(entityTemplate.select, { count: 'exact' })
      .eq('company_id', companyId);

    if (validated.reportEntity === 'ASSETS') {
      if (filters.status) entityQuery = entityQuery.eq('status', filters.status);
      if (assetIdsForProject) entityQuery = entityQuery.in('id', assetIdsForProject.length ? assetIdsForProject : ['00000000-0000-0000-0000-000000000000']);
    } else if (validated.reportEntity === 'MAINTENANCE') {
      if (filters.status) entityQuery = entityQuery.eq('status', filters.status);
      if (filters.assetId) entityQuery = entityQuery.eq('asset_id', filters.assetId);
      if (filters.responsibleId) entityQuery = entityQuery.eq('responsible_id', filters.responsibleId);
      if (filters.dateStart) entityQuery = entityQuery.gte('maintenance_date', filters.dateStart);
      if (filters.dateEnd) entityQuery = entityQuery.lte('maintenance_date', filters.dateEnd);
    } else if (validated.reportEntity === 'INCIDENTS') {
      if (filters.priority) entityQuery = entityQuery.eq('priority', filters.priority);
      if (filters.incidentStatus) entityQuery = entityQuery.eq('status', filters.incidentStatus);
      if (filters.dateStart) entityQuery = entityQuery.gte('reported_at', filters.dateStart);
      if (filters.dateEnd) entityQuery = entityQuery.lte('reported_at', filters.dateEnd);
    } else if (validated.reportEntity === 'PROJECTS') {
      if (filters.status) entityQuery = entityQuery.eq('status', filters.status);
      if (filters.dateStart) entityQuery = entityQuery.gte('start_date', filters.dateStart);
      if (filters.dateEnd) entityQuery = entityQuery.lte('start_date', filters.dateEnd);
    } else if (validated.reportEntity === 'DOCUMENTS') {
      if (filters.assetId) entityQuery = entityQuery.eq('asset_id', filters.assetId);
      if (filters.dateStart) entityQuery = entityQuery.gte('expires_at', filters.dateStart);
      if (filters.dateEnd) entityQuery = entityQuery.lte('expires_at', filters.dateEnd);
    }

    const { data: entityRows, count, error: entityError } = await entityQuery
      .order('created_at', { ascending: false })
      .limit(5000);

    console.log('REPORT_ENTITY_QUERY', {
      companyId,
      entity: validated.reportEntity,
      table: entityTable,
      count,
      error: entityError?.message,
    });

    if (entityError) {
      // Previously this was only logged and treated as "no rows", which meant a
      // broken select() (bad column name, RLS denial, etc.) silently showed the
      // misleading "No hay datos para exportar" message instead of a real error.
      return { success: false, error: 'No fue posible consultar los datos del informe.' };
    }

    // entityTable is a dynamic string (chosen at runtime from ReportEntityKey), so the
    // untyped query builder can't resolve its row shape - cast to the real runtime shape.
    data = (entityRows || []) as unknown as Record<string, unknown>[];
    // Reflects exactly what was exported, not the true total match count - a
    // company with more than 5000 matching rows only ever gets the newest
    // 5000 in a single export (see ordering above), so the reported count
    // must match the actual row count in the file rather than the full total.
    recordCount = data.length;

    if (!data || data.length === 0) {
      return { success: false, error: 'No hay datos para exportar.' };
    }

    // STEP 1: Create initial report record with status GENERATING
    const fileExtension = validated.reportFormat === 'PDF' ? 'pdf' : 'xlsx';
    const fileName = `${validated.reportEntity}_${new Date().toISOString().split('T')[0]}_${Date.now()}.${fileExtension}`;
    // Sin prefijo "reports/": el bucket ya se llama así, y la policy RLS de storage.objects
    // exige que el primer segmento de carpeta sea el companyId, no el nombre del bucket.
    const storagePath = `${companyId}/${fileName}`;
    const reportCode = `INF-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const executiveSummary = `Informe profesional generado para ${company?.name || 'la empresa'} con ${recordCount} registros y enfoque operativo.`;
    const entityLabel = REPORT_ENTITY_LABELS[validated.reportEntity as ReportEntityKey] || validated.reportEntity;
    const generalInformation = `Empresa: ${companySettings?.company_name || company?.name || 'Empresa'}\nResponsable: ${currentUserProfile?.full_name || 'Sistema'}\nEntidad: ${entityLabel}\nFormato: ${validated.reportFormat}`;
    const observations = 'Este documento fue generado automáticamente desde los registros del sistema y debe revisarse antes de enviarlo a clientes o supervisores.';
    const conclusions = 'Se recomienda validar el estado operativo y consolidar cualquier acción pendiente antes de cerrar el informe.';
    const evidenceSummary = 'Se incluyen evidencias y observaciones cuando estén disponibles en el sistema.';
    const evidenceItems = (data as Record<string, unknown>[] || [])
      .filter((row) => row?.evidence_before_url || row?.evidence_after_url || row?.before_image_url || row?.after_image_url || row?.evidence_before || row?.evidence_after)
      .slice(0, 3)
      .map((row) => ({
        title: (row?.title || row?.name || 'Evidencia documental') as string,
        notes: (row?.observations || row?.notes || 'Registro documentado para referencia del cliente.') as string,
        beforeUrl: (row?.evidence_before_url || row?.before_image_url || row?.evidence_before || undefined) as string | undefined,
        afterUrl: (row?.evidence_after_url || row?.after_image_url || row?.evidence_after || undefined) as string | undefined,
      }));
    const signatures = [
      { label: 'Elaborado por', name: currentUserProfile?.full_name || 'Responsable del informe' },
      { label: 'Aprobado por', name: companySettings?.company_name || company?.name || 'Dirección' },
    ];
    const publicRelativePath = `/reports/${companyId}/${fileName}`;
    const localStoragePath = path.join(process.cwd(), 'public', 'reports', companyId, fileName);

    const insertPayload = {
      company_id: companyId,
      report_type: validated.reportEntity,
      report_entity: validated.reportEntity,
      report_format: validated.reportFormat,
      file_format: validated.reportFormat,
      template_name: validated.templateName || 'standard',
      record_count: recordCount,
      row_count: recordCount,
      file_path: storagePath,
      generated_by: userId,
      status: 'GENERATING',
      filters: filters,
      filters_applied: filters,
      file_size_bytes: null,
      file_url: null,
      generation_time_ms: null,
      error_message: null,
    };

    console.log('REPORT_INSERT_INITIAL_PAYLOAD', JSON.stringify(insertPayload, null, 2));

    const { data: report, error: reportInsertError } = await supabase
      .from('generated_reports')
      .insert(insertPayload as Record<string, unknown>)
      .select()
      .single();

    if (reportInsertError || !report) {
      console.error('REPORT_INSERT_ERROR', {
        error: reportInsertError?.message,
        details: reportInsertError?.details,
      });
      return { success: false, error: 'No se pudo crear el registro del informe.' };
    }

    reportId = report.id;
    console.log('REPORT_CREATED', {
      reportId: report.id,
      entity: validated.reportEntity,
      format: validated.reportFormat,
      recordCount,
      status: 'GENERATING',
    });

    // STEP 2: Generate file (PDF or Excel)
    let fileBuffer: Buffer;
    const { generatePdf, generateExcel } = await import('@/lib/reports/generators');
    const { formatReportData } = await import('@/lib/reports/utils');

    const { columns, data: formattedData } = formatReportData(data, validated.reportEntity);

    if (validated.reportFormat === 'PDF') {
      fileBuffer = await generatePdf(formattedData, {
        title: `Informe profesional de ${entityLabel}`,
        columns,
        companyName: companySettings?.company_name || company.name,
        reportType: entityLabel,
        generatedDate: formatDateTime(new Date()),
        companyLogoUrl: companySettings?.logo_url || undefined,
        reportCode,
        responsibleName: currentUserProfile?.full_name || 'Sistema',
        executiveSummary,
        generalInformation,
        observations,
        conclusions,
        evidenceSummary,
        evidenceItems,
        signatures,
        colorScheme: selectedTemplate?.color_scheme || undefined,
        includeLogo: selectedTemplate?.include_logo ?? true,
      });
    } else {
      fileBuffer = await generateExcel(formattedData, {
        title: `Informe de ${entityLabel}`,
        columns,
        companyName: company.name,
        reportType: entityLabel,
        generatedDate: formatDateTime(new Date()),
      });
    }

    console.log('REPORT_FILE_GENERATED', {
      reportId: report.id,
      format: validated.reportFormat,
      bufferSize: fileBuffer.length,
    });

    // STEP 3: Upload to Supabase Storage when available; otherwise save a public fallback file locally.
    let finalDownloadUrl = publicRelativePath;
    let uploadPath = storagePath;

    try {
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('reports')
        .upload(storagePath, fileBuffer, {
          contentType: validated.reportFormat === 'PDF' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          upsert: false,
        });

      if (!uploadError && uploadData) {
        uploadPath = uploadData.path;
        const { data: urlData, error: urlError } = await supabase.storage
          .from('reports')
          .createSignedUrl(storagePath, 3600);

        if (!urlError && urlData?.signedUrl) {
          finalDownloadUrl = urlData.signedUrl;
        }
      } else {
        throw uploadError || new Error('Storage upload unavailable');
      }
    } catch (storageError) {
      console.warn('REPORT_STORAGE_FALLBACK', {
        reportId: report.id,
        error: storageError instanceof Error ? storageError.message : String(storageError),
      });

      // Vercel serverless functions have a read-only filesystem (no /public writes
      // persist or are servable across invocations) - only fall back to local disk
      // in local development, otherwise surface the Storage failure as a hard error.
      if (process.env.VERCEL) {
        throw storageError instanceof Error ? storageError : new Error('Storage upload unavailable');
      }

      await mkdir(path.dirname(localStoragePath), { recursive: true });
      await writeFile(localStoragePath, fileBuffer);
      finalDownloadUrl = publicRelativePath;
    }

    console.log('REPORT_FILE_CREATED', {
      reportId: report.id,
      filePath: uploadPath,
      size: fileBuffer.length,
      finalDownloadUrl,
    });

    // STEP 5: Update report with file_url and final status
    const generationTimeMs = Date.now() - startTime;

    const updatePayload = {
      file_url: finalDownloadUrl,
      file_path: uploadPath,
      file_size_bytes: fileBuffer.length,
      status: 'READY',
      generation_time_ms: generationTimeMs,
    };

    console.log('REPORT_UPDATE_PAYLOAD', updatePayload);

    const result = await supabase
      .from('generated_reports')
      .update(updatePayload)
      .eq('id', report.id);

    console.log('REPORT_UPDATE_RESULT', result);

    if (result.error) {
      const error = result.error;
      console.error('REPORT_UPDATE_ERROR', {
        reportId: report.id,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
      });

      const fallbackResult = await supabase
        .from('generated_reports')
        .update({
          file_url: finalDownloadUrl,
          file_path: uploadPath,
          file_size_bytes: fileBuffer.length,
          status: 'READY',
        })
        .eq('id', report.id);

      console.log('REPORT_FALLBACK_UPDATE_RESULT', fallbackResult);

      if (fallbackResult.error) {
        const fallbackError = fallbackResult.error;
        console.error('REPORT_FALLBACK_UPDATE_ERROR', {
          reportId: report.id,
          message: fallbackError?.message,
          details: fallbackError?.details,
          hint: fallbackError?.hint,
          code: fallbackError?.code,
        });
        return {
          success: false,
          error: `No se pudo actualizar el informe: ${fallbackError?.message || 'Error desconocido'}${fallbackError?.details ? ` | ${fallbackError.details}` : ''}`,
        };
      }
    }

    console.log('REPORT_COMPLETED', {
      reportId: report.id,
      status: 'READY',
      generationTimeMs,
      fileSizeBytes: fileBuffer.length,
    });

    // Opt-in only (email_subscriptions.enabled defaults to false/no row -
    // see components/email-preferences-form.tsx): a user must have
    // explicitly turned on "Informe generado" notifications before this
    // sends anything, so wiring this up doesn't start emailing anyone who
    // never asked for it.
    if (currentUserProfile?.email) {
      const { data: subscription } = await supabase
        .from('email_subscriptions')
        .select('enabled, frequency')
        .eq('company_id', companyId)
        .eq('user_id', userId)
        .eq('event_type', 'REPORT_GENERATED')
        .maybeSingle();

      if (subscription?.enabled && subscription.frequency === 'IMMEDIATE') {
        const { reportGeneratedEmail } = await import('@/lib/email/templates');
        const { enqueueEmail } = await import('@/lib/email/mailer');
        const { subject, html } = reportGeneratedEmail(
          {
            companyName: companySettings?.company_name || company?.name || 'Empresa',
            primaryColor: companySettings?.primary_color || '#0f172a',
            logoUrl: companySettings?.logo_url || null,
          },
          { reportLabel: `${entityLabel} (${validated.reportFormat})`, downloadUrl: finalDownloadUrl }
        );
        await enqueueEmail({
          companyId,
          to: currentUserProfile.email,
          subject,
          html,
          templateKey: 'report_generated',
          createdBy: userId,
        });
      }
    }

    // The status transition to READY is already captured by the
    // audit_generated_reports trigger (write_audit_log(), see
    // 004_reports_evidence.sql) - no separate audit_logs insert needed here.
    // (It previously used an invalid audit_action enum value, 'GENERATE_REPORT',
    // which would have failed silently since its result was never checked.)

    await trackAnalyticsEvent('GENERATE_REPORT', { entity: validated.reportEntity, format: validated.reportFormat });

    return {
      success: true,
      reportId: report.id,
      fileName,
      recordCount,
      fileSize: fileBuffer.length,
      downloadUrl: finalDownloadUrl,
      message: 'Informe generado correctamente.',
    };
  } catch (error) {
    // Update report with error if it was created
    if (reportId) {
      try {
        const supabase = await createClient();
        console.error('REPORT_GENERATION_FAILED', {
          reportId,
          error: error instanceof Error ? error.message : String(error),
        });
        await supabase
          .from('generated_reports')
          .update({
            status: 'FAILED',
            error_message: 'No se pudo generar el informe. Intenta de nuevo o contacta a soporte.',
          })
          .eq('id', reportId);
      } catch (updateErr) {
        console.error('REPORT_ERROR_UPDATE_FAILED', { reportId, error: updateErr });
      }
    }

    if (error instanceof ZodError) {
      // Previously showed the raw Zod field name and English message
      // straight to the end user (e.g. "❌ reportEntity: String must contain
      // at least 1 character(s)") - confusing and unprofessional for a
      // Spanish-language business app. A missing/invalid reportEntity is by
      // far the most common way to hit this (submitting without picking a
      // report type), so that gets a specific, actionable message; anything
      // else falls back to a generic one rather than leaking field internals.
      console.error('REPORT_VALIDATION_ERROR', { fieldErrors: error.flatten().fieldErrors });
      const hasEntityError = error.flatten().fieldErrors.reportEntity;
      return {
        success: false,
        error: hasEntityError
          ? 'Selecciona un tipo de informe antes de generarlo.'
          : 'Revisa los datos del formulario e intenta de nuevo.'
      };
    }

    console.error('REPORT_GENERATION_ERROR', {
      error: error instanceof Error ? error.message : String(error),
      reportId,
    });

    return { success: false, error: 'No se pudo generar el informe.' };
  }
}

/**
 * Create Report Template
 * Admin-only action to create custom report templates
 */
export async function createReportTemplate(formData: FormData) {
  try {
    await assertSameOrigin();
    await assertRateLimit('createTemplate', 5);

    const { companyId, userId, role } = await getTenantContext();

    if (role !== 'ADMIN') {
      return { success: false, error: 'Se requiere acceso de administrador.' };
    }

    // El formulario (components/report-template-builder.tsx) envía los campos en
    // snake_case (name, slug, layout_type, color_scheme, page_size, orientation,
    // margin_top/bottom/left/right, include_*), no en camelCase.
    const templateName = sanitizeText(formData.get('name') as string);
    const templateSlug = sanitizeText(formData.get('slug') as string).toLowerCase() || undefined;
    const layoutType = formData.get('layout_type') as string;
    const colorScheme = formData.get('color_scheme') as string;
    const pageSize = formData.get('page_size') as string;
    const orientation = formData.get('orientation') as string;
    const includeLogo = formData.get('include_logo') !== 'false';
    const toNumber = (value: FormDataEntryValue | null, fallback: number) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    };

    const validated = reportTemplateSchema.parse({
      name: templateName,
      slug: templateSlug || templateName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      layout_type: layoutType,
      color_scheme: colorScheme || undefined,
      include_logo: includeLogo,
      page_size: pageSize || undefined,
      orientation: orientation || undefined,
      margin_top: toNumber(formData.get('margin_top'), 1.0),
      margin_bottom: toNumber(formData.get('margin_bottom'), 1.0),
      margin_left: toNumber(formData.get('margin_left'), 0.75),
      margin_right: toNumber(formData.get('margin_right'), 0.75),
    });

    const supabase = await createClient();

    const { data: template, error } = await supabase
      .from('report_templates')
      .insert({
        company_id: companyId,
        created_by: userId,
        name: validated.name,
        slug: validated.slug,
        layout_type: validated.layout_type,
        color_scheme: validated.color_scheme,
        include_logo: validated.include_logo,
        page_size: validated.page_size,
        orientation: validated.orientation,
        margin_top: validated.margin_top,
        margin_bottom: validated.margin_bottom,
        margin_left: validated.margin_left,
        margin_right: validated.margin_right,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'Ya existe una plantilla con ese nombre.' };
      }
      console.error('Create template error:', error);
      return { success: false, error: 'No se pudo crear la plantilla.' };
    }

    return { success: true, template, message: 'Plantilla creada correctamente.' };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: 'Datos inválidos.' };
    }
    console.error('Create template error:', error);
    return { success: false, error: 'No se pudo crear la plantilla.' };
  }
}

/**
 * Update Report Template
 * Admin-only action to edit an existing custom report template
 */
export async function updateReportTemplate(templateId: string, formData: FormData) {
  try {
    await assertSameOrigin();
    await assertRateLimit('updateTemplate', 10);

    const { companyId, role } = await getTenantContext();

    if (role !== 'ADMIN') {
      return { success: false, error: 'Se requiere acceso de administrador.' };
    }

    const templateName = sanitizeText(formData.get('name') as string);
    const templateSlug = sanitizeText(formData.get('slug') as string).toLowerCase() || undefined;
    const layoutType = formData.get('layout_type') as string;
    const colorScheme = formData.get('color_scheme') as string;
    const pageSize = formData.get('page_size') as string;
    const orientation = formData.get('orientation') as string;
    const includeLogo = formData.get('include_logo') !== 'false';
    const toNumber = (value: FormDataEntryValue | null, fallback: number) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    };

    const validated = reportTemplateSchema.parse({
      name: templateName,
      slug: templateSlug || templateName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      layout_type: layoutType,
      color_scheme: colorScheme || undefined,
      include_logo: includeLogo,
      page_size: pageSize || undefined,
      orientation: orientation || undefined,
      margin_top: toNumber(formData.get('margin_top'), 1.0),
      margin_bottom: toNumber(formData.get('margin_bottom'), 1.0),
      margin_left: toNumber(formData.get('margin_left'), 0.75),
      margin_right: toNumber(formData.get('margin_right'), 0.75),
    });

    const supabase = await createClient();

    const { data: template, error } = await supabase
      .from('report_templates')
      .update({
        name: validated.name,
        slug: validated.slug,
        layout_type: validated.layout_type,
        color_scheme: validated.color_scheme,
        include_logo: validated.include_logo,
        page_size: validated.page_size,
        orientation: validated.orientation,
        margin_top: validated.margin_top,
        margin_bottom: validated.margin_bottom,
        margin_left: validated.margin_left,
        margin_right: validated.margin_right,
      })
      .eq('id', templateId)
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'Ya existe una plantilla con ese nombre.' };
      }
      console.error('Update template error:', error);
      return { success: false, error: 'No se pudo actualizar la plantilla.' };
    }

    return { success: true, template, message: 'Plantilla actualizada correctamente.' };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: 'Datos inválidos.' };
    }
    console.error('Update template error:', error);
    return { success: false, error: 'No se pudo actualizar la plantilla.' };
  }
}

/**
 * Create Report Schedule
 * Admin-only action to schedule recurring reports
 */
export async function createReportSchedule(formData: FormData) {
  try {
    await assertSameOrigin();
    await assertRateLimit('createSchedule', 5);

    const { companyId, userId, role } = await getTenantContext();

    if (role !== 'ADMIN') {
      return { success: false, error: 'Se requiere acceso de administrador.' };
    }

    // El formulario (components/report-schedule-manager.tsx) envía los campos en
    // snake_case (name, report_entity, frequency, time_of_day, report_format,
    // email_recipients), no en camelCase.
    const scheduleName = sanitizeText(formData.get('name') as string);
    const reportEntity = formData.get('report_entity') as string;
    const frequency = formData.get('frequency') as string;
    const reportFormat = formData.get('report_format') as string;
    const rawTimeOfDay = sanitizeText(formData.get('time_of_day') as string);
    // El <input type="time"> del navegador entrega "HH:MM"; el esquema exige "HH:MM:SS".
    const timeOfDay = /^\d{2}:\d{2}$/.test(rawTimeOfDay) ? `${rawTimeOfDay}:00` : rawTimeOfDay;
    const emailRecipients = sanitizeText(formData.get('email_recipients') as string)
      .split(',')
      .map((email) => email.trim())
      .filter(Boolean);

    const validated = reportScheduleSchema.parse({
      name: scheduleName,
      report_entity: reportEntity,
      frequency,
      time_of_day: timeOfDay,
      report_format: reportFormat,
      email_recipients: emailRecipients,
    });

    const supabase = await createClient();

    const { data: schedule, error } = await supabase
      .from('report_schedules')
      .insert({
        company_id: companyId,
        created_by: userId,
        name: validated.name,
        report_type: validated.report_entity,
        report_entity: validated.report_entity,
        frequency: validated.frequency,
        time_of_day: validated.time_of_day,
        report_format: validated.report_format,
        email_recipients: validated.email_recipients,
        enabled: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Create schedule error:', error);
      return { success: false, error: 'No se pudo crear la programación.' };
    }

    return { success: true, schedule, message: 'Programación creada correctamente.' };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: 'Datos inválidos.' };
    }
    console.error('Create schedule error:', error);
    return { success: false, error: 'No se pudo crear la programación.' };
  }
}

export async function deleteReportTemplate(templateId: string) {
  try {
    await assertSameOrigin();
    await assertRateLimit('deleteTemplate', 10);

    const { companyId, role } = await getTenantContext();

    if (role !== 'ADMIN') {
      return { success: false, error: 'Se requiere acceso de administrador.' };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from('report_templates')
      .delete()
      .eq('id', templateId)
      .eq('company_id', companyId);

    if (error) {
      console.error('Delete template error:', error);
      return { success: false, error: 'No se pudo eliminar la plantilla.' };
    }

    return { success: true, message: 'Plantilla eliminada correctamente.' };
  } catch (error) {
    console.error('Delete template error:', error);
    return { success: false, error: 'No se pudo eliminar la plantilla.' };
  }
}

export async function deleteReportSchedule(scheduleId: string) {
  try {
    await assertSameOrigin();
    await assertRateLimit('deleteSchedule', 10);

    const { companyId, role } = await getTenantContext();

    if (role !== 'ADMIN') {
      return { success: false, error: 'Se requiere acceso de administrador.' };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from('report_schedules')
      .delete()
      .eq('id', scheduleId)
      .eq('company_id', companyId);

    if (error) {
      console.error('Delete schedule error:', error);
      return { success: false, error: 'No se pudo eliminar la programación.' };
    }

    return { success: true, message: 'Programación eliminada correctamente.' };
  } catch (error) {
    console.error('Delete schedule error:', error);
    return { success: false, error: 'No se pudo eliminar la programación.' };
  }
}

/**
 * Update Report Preferences
 * Save user's default report settings
 */

export type SendReportEmailState = { success: boolean; message?: string; error?: string };

/**
 * Sends an already-generated report as a PDF/Excel attachment to an
 * arbitrary recipient (e.g. a client), on demand from the "Enviar por
 * correo" button. Unlike the opt-in "informe generado" notification above
 * (queued, fires only to the generating user, no attachment), this is a
 * synchronous, explicit user action - see sendEmailNow's docstring for why
 * awaiting delivery inline is safe here specifically.
 */
export async function sendReportByEmail(reportId: string, formData: FormData): Promise<SendReportEmailState> {
  try {
    await assertSameOrigin();
    await assertRateLimit('sendReportByEmail', 10);

    const { companyId, userId } = await getTenantContext();

    const to = sanitizeText(formData.get('to'), 255);
    const cc = sanitizeText(formData.get('cc') || '', 255);
    const subjectInput = sanitizeText(formData.get('subject') || '', 200);
    const message = sanitizeText(formData.get('message') || '', 2000);

    const emailSchema = z.string().email();
    if (!emailSchema.safeParse(to).success) {
      return { success: false, error: 'Ingresa un correo de destino válido.' };
    }
    if (cc && !emailSchema.safeParse(cc).success) {
      return { success: false, error: 'El correo en copia (CC) no es válido.' };
    }

    const supabase = await createClient();

    const { data: report } = await supabase
      .from('generated_reports')
      .select('id, report_type, report_entity, report_format, file_path, status')
      .eq('id', reportId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (!report || !report.file_path) {
      return { success: false, error: 'No se encontró el informe o no tiene un archivo asociado.' };
    }
    if (report.status !== 'GENERATED' && report.status !== 'READY') {
      return { success: false, error: 'El informe aún no está listo para enviarse.' };
    }

    let fileBuffer: Buffer;
    if (report.file_path.startsWith('/reports/')) {
      fileBuffer = await readFile(path.join(process.cwd(), 'public', report.file_path.slice(1)));
    } else {
      const { data: blob, error: downloadError } = await supabase.storage.from('reports').download(report.file_path);
      if (downloadError || !blob) {
        console.error('Send report by email download error:', downloadError?.message);
        return { success: false, error: 'No se pudo obtener el archivo del informe.' };
      }
      fileBuffer = Buffer.from(await blob.arrayBuffer());
    }

    const [{ data: company }, { data: companySettings }, { data: userProfile }] = await Promise.all([
      supabase.from('companies').select('name').eq('id', companyId).single(),
      supabase.from('company_settings').select('company_name, primary_color, logo_url').eq('company_id', companyId).maybeSingle(),
      supabase.from('users').select('full_name').eq('id', userId).maybeSingle(),
    ]);

    const reportLabel = report.report_type === 'TECHNICAL_REPORT'
      ? 'Informe técnico'
      : `${REPORT_ENTITY_LABELS[report.report_entity as ReportEntityKey] ?? report.report_entity} (${report.report_format})`;

    const { reportSharedEmail } = await import('@/lib/email/templates');
    const { sendEmailNow } = await import('@/lib/email/mailer');

    const { subject, html } = reportSharedEmail(
      {
        companyName: companySettings?.company_name || company?.name || 'Empresa',
        primaryColor: companySettings?.primary_color || '#0f172a',
        logoUrl: companySettings?.logo_url || null,
      },
      {
        reportLabel,
        senderName: userProfile?.full_name || 'Un miembro del equipo',
        message: message || undefined,
      }
    );

    const fileName = `${reportLabel.replace(/[^a-z0-9]+/gi, '-')}.${report.report_format === 'EXCEL' ? 'xlsx' : 'pdf'}`;

    const result = await sendEmailNow({
      companyId,
      to,
      cc: cc || undefined,
      subject: subjectInput || subject,
      html,
      templateKey: 'report_shared',
      attachments: [{ filename: fileName, content: fileBuffer }],
      createdBy: userId,
    });

    if (!result.ok) {
      return { success: false, error: result.error || 'No se pudo enviar el correo.' };
    }

    return { success: true, message: `Informe enviado a ${to}.` };
  } catch (error) {
    console.error('Send report by email error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'No se pudo enviar el correo.' };
  }
}
