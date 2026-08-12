'use server';

import jsPDF, { GState } from 'jspdf';
import ExcelJS from 'exceljs';
import sharp from 'sharp';
import { readFile } from 'fs/promises';
import path from 'path';
import { darkenHex, hexToRgb, resolveTemplateColorHex } from '@/lib/reports/color-palette';
import { formatDateTime } from '@/lib/utils';

// Neutral EmpresaOS mark (public/icon.svg rasterized) used as the fallback
// logo/watermark for ANY company that hasn't configured its own
// company_settings.logo_url - including Progrúas itself, until it sets one.
// Deliberately NOT a Progrúas asset: no company's branding should ever
// appear on another company's report as a "global default" (see the RC1
// multi-tenant branding audit). Per-company branding is driven entirely by
// options.companyLogoUrl, resolved from that company's own company_settings
// row (lib/actions/reports.ts, lib/actions/technical-reports.ts) - this path
// is only reached when a tenant hasn't set one yet.
const DEFAULT_LOGO_PATH = '/branding/empresaos-logo.png';

/**
 * Every image ends up printed at most a few centimeters wide in the PDF
 * (evidence boxes, signatures, the logo), but source files can be full
 * camera-resolution photos (several MB, thousands of pixels wide). Without
 * downscaling, jsPDF embeds the source pixels as-is, which previously made a
 * two-photo technical report balloon to ~10 MB. Capping the longest side and
 * re-encoding as JPEG keeps embedded images print-quality while keeping file
 * size sane; PNGs are kept as PNG only when they carry transparency (logos).
 */
async function compressForEmbedding(buffer: Buffer, mime: string): Promise<{ buffer: Buffer; mime: string }> {
  try {
    const image = sharp(buffer).rotate();
    const metadata = await image.metadata();
    const resized = image.resize({ width: 1000, height: 1000, fit: 'inside', withoutEnlargement: true });

    if (mime === 'image/png' && metadata.hasAlpha) {
      const out = await resized.png({ compressionLevel: 9, quality: 82 }).toBuffer();
      return { buffer: out, mime: 'image/png' };
    }

    const out = await resized.jpeg({ quality: 74, mozjpeg: true }).toBuffer();
    return { buffer: out, mime: 'image/jpeg' };
  } catch (error) {
    console.warn('COMPRESS_IMAGE_FAILED', { error: error instanceof Error ? error.message : String(error) });
    return { buffer, mime };
  }
}

/**
 * Resolves a logo/evidence/signature image reference to a base64 data URI
 * that jsPDF's addImage() can embed directly. jsPDF running in Node cannot
 * fetch a bare URL itself (that only works in a browser Image element), so
 * passing a raw Supabase Storage URL or a local "/evidence/..." path straight
 * into addImage silently fails and falls back to the placeholder box.
 */
async function resolveImageAsBase64(source?: string | null): Promise<string | null> {
  if (!source) return null;
  if (source.startsWith('data:')) {
    const match = /^data:([^;]+);base64,(.*)$/.exec(source);
    if (!match) return source;
    const { buffer, mime } = await compressForEmbedding(Buffer.from(match[2], 'base64'), match[1]);
    return `data:${mime};base64,${buffer.toString('base64')}`;
  }

  try {
    let rawBuffer: Buffer;
    let mime: string;

    if (source.startsWith('http://') || source.startsWith('https://')) {
      const response = await fetch(source);
      if (!response.ok) return null;
      mime = response.headers.get('content-type') || 'image/png';
      rawBuffer = Buffer.from(await response.arrayBuffer());
    } else {
      const relativePath = source.startsWith('/') ? source.slice(1) : source;
      const filePath = path.join(process.cwd(), 'public', relativePath);
      rawBuffer = await readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    }

    const { buffer, mime: outMime } = await compressForEmbedding(rawBuffer, mime);
    return `data:${outMime};base64,${buffer.toString('base64')}`;
  } catch (error) {
    console.warn('RESOLVE_IMAGE_FAILED', {
      source,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Reads width/height off a resolveImageAsBase64() data URI so the watermark
 * can be drawn at the source image's real aspect ratio. That source is now
 * per-company (the same logo used in the header, see callers below), not a
 * fixed Progrúas asset, so a hardcoded ratio would distort other companies'
 * logos.
 */
async function getImageAspect(dataUri: string | null): Promise<number> {
  if (!dataUri) return 1;
  const match = /^data:[^;]+;base64,(.*)$/.exec(dataUri);
  if (!match) return 1;
  try {
    const metadata = await sharp(Buffer.from(match[1], 'base64')).metadata();
    if (!metadata.width || !metadata.height) return 1;
    return metadata.height / metadata.width;
  } catch (error) {
    console.warn('WATERMARK_ASPECT_READ_FAILED', { error: error instanceof Error ? error.message : String(error) });
    return 1;
  }
}

/**
 * Draws the company's own logo (or the neutral EmpresaOS mark, see
 * DEFAULT_LOGO_PATH) centered on the current page at very low opacity,
 * behind nothing (called after content, before the footer, since jsPDF has
 * no z-order/layers - "behind" just means drawn where it won't overlap
 * dense text). Restores full opacity afterward so the footer text drawn
 * right after this call isn't also faded.
 */
function drawWatermark(doc: jsPDF, watermarkImage: string, aspect: number, pageWidth: number, pageHeight: number) {
  const width = pageWidth * 0.5;
  const height = width * aspect;
  const x = (pageWidth - width) / 2;
  const y = (pageHeight - height) / 2;
  try {
    doc.setGState(new GState({ opacity: 0.06 }));
    doc.addImage(watermarkImage, x, y, width, height);
  } catch (error) {
    console.warn('WATERMARK_DRAW_FAILED', { error: error instanceof Error ? error.message : String(error) });
  } finally {
    doc.setGState(new GState({ opacity: 1 }));
  }
}

/**
 * Generate PDF Report
 * Creates a professional PDF document from report data
 */
export async function generatePdf(
  reportData: Record<string, unknown>[],
  options: {
    title: string;
    columns: string[];
    companyName?: string;
    reportType?: string;
    generatedDate?: string;
    companyLogoUrl?: string;
    reportCode?: string;
    responsibleName?: string;
    executiveSummary?: string;
    generalInformation?: string;
    observations?: string;
    conclusions?: string;
    evidenceSummary?: string;
    evidenceItems?: Array<{
      title?: string;
      notes?: string;
      beforeUrl?: string;
      afterUrl?: string;
    }>;
    signatures?: Array<{
      label: string;
      name?: string;
    }>;
    /** report_templates.color_scheme (named palette value or a raw #RRGGBB hex). */
    colorScheme?: string;
    /** report_templates.include_logo - defaults to true. */
    includeLogo?: boolean;
  }
): Promise<Buffer> {
  try {
    console.log('REPORT_PDF_GENERATION_START', {
      recordCount: reportData.length,
      columns: options.columns.length,
      title: options.title,
    });

    const schemeHex = resolveTemplateColorHex(options.colorScheme);
    const [accentR, accentG, accentB] = hexToRgb(schemeHex);
    const [headerR, headerG, headerB] = darkenHex(schemeHex, 0.55);
    const includeLogo = options.includeLogo !== false;

    // Con muchas columnas, vertical A4 deja tan poco ancho por columna que los
    // encabezados quedan ilegibles (partidos en 2-3 líneas de 1-2 caracteres).
    // A partir de 8 columnas se usa horizontal, que da ~50% más de ancho útil.
    const columnCount = Math.max(options.columns.length, 1);
    const orientation = columnCount > 8 ? 'landscape' : 'portrait';

    const doc = new jsPDF({
      orientation,
      unit: 'mm',
      format: 'a4',
    });

    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = columnCount > 8 ? 10 : 14;
    const contentWidth = pageWidth - 2 * margin;
    const lineHeight = 5;
    let yPosition = margin;
    const evidenceItems = options.evidenceItems?.length ? options.evidenceItems : [];
    const signatures = options.signatures?.length ? options.signatures : [
      { label: 'Elaborado por', name: options.responsibleName || 'Responsable del informe' },
      { label: 'Aprobado por', name: options.companyName || 'Dirección' },
    ];

    const addSectionTitle = (title: string, x = margin) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(title, x, yPosition);
      yPosition += 6;
      doc.setDrawColor(accentR, accentG, accentB);
      doc.setLineWidth(0.4);
      doc.line(x, yPosition, x + 60, yPosition);
      yPosition += 4;
    };

    const addParagraph = (text: string, x = margin, maxWidth = contentWidth) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);
      const splitText = doc.splitTextToSize(text, maxWidth);
      doc.text(splitText, x, yPosition);
      yPosition += splitText.length * lineHeight + 1;
    };

    const addInfoBox = (label: string, value: string, x: number, width: number, height = 18) => {
      doc.setFillColor(240, 249, 255);
      doc.setDrawColor(14, 116, 144);
      doc.roundedRect(x, yPosition, width, height, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.2);
      doc.setTextColor(8, 47, 73);
      doc.text(label, x + 3, yPosition + 5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(value, x + 3, yPosition + 11, { maxWidth: width - 6 });
    };

    doc.setFillColor(headerR, headerG, headerB);
    doc.rect(0, 0, pageWidth, 44, 'F');

    // Logo/placeholder drawn first: the title/company text below starts at
    // titleX (past the logo box) so an opaque logo image or placeholder never
    // paints over the header text that used to share the same x position.
    // Falls back to the Progrúas logo when the company hasn't set its own
    // logo_url, and is skipped entirely when the template has include_logo=false.
    const logoImage = includeLogo ? await resolveImageAsBase64(options.companyLogoUrl || DEFAULT_LOGO_PATH) : null;
    if (includeLogo) {
      try {
        if (!logoImage) throw new Error('No logo available');
        doc.addImage(logoImage, margin, 8, 20, 20);
      } catch {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(margin, 8, 20, 20, 2, 2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text((options.companyName || 'E').slice(0, 2).toUpperCase(), margin + 10, 20, { align: 'center' });
      }
    }

    const titleX = margin + 24;
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(options.title, titleX, 16);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(options.companyName || 'Empresa', titleX, 24);
    doc.text(`Generado: ${options.generatedDate || formatDateTime(new Date())}`, pageWidth - margin, 24, { align: 'right' });
    doc.text(`Código: ${options.reportCode || 'SIN-CODIGO'}`, pageWidth - margin, 31, { align: 'right' });

    yPosition = 54;

    addSectionTitle('Resumen ejecutivo');
    addParagraph(options.executiveSummary || `Informe generado para ${options.companyName || 'la empresa'} con ${reportData.length} registros.`);

    addSectionTitle('Información general');
    const infoLineHeight = 18;
    addInfoBox('Empresa', options.companyName || 'Empresa', margin, 85, infoLineHeight);
    addInfoBox('Responsable', options.responsibleName || 'Sistema', margin + 90, 55, infoLineHeight);
    addInfoBox('Tipo', options.reportType || 'General', margin + 150, 45, infoLineHeight);
    yPosition += infoLineHeight + 4;

    addParagraph(options.generalInformation || 'Datos consolidados del sistema.');

    addSectionTitle('Detalle del informe');
    const columnWidth = contentWidth / columnCount;
    // Con muchas columnas cada una mide pocos milímetros: se reduce la fuente y se
    // usa una fila de encabezado más alta para que quepan 2 líneas sin verse cortadas.
    const headerFontSize = columnCount > 14 ? 6 : columnCount > 8 ? 7 : 8;
    const cellFontSize = columnCount > 14 ? 6 : columnCount > 8 ? 6.8 : 7.8;
    const headerRowHeight = columnCount > 8 ? 9 : 6;
    const rowHeight = 6;

    const drawTableHeader = (top: number) => {
      // Draw every cell's fill first and only then place text. Interleaving
      // rect() fills with text() calls that use the `maxWidth` option corrupts
      // jsPDF's fill-color state across iterations (renders as a solid block
      // covering every column past the first) - splitTextToSize + a second
      // pass avoids that.
      doc.setFillColor(accentR, accentG, accentB);
      options.columns.forEach((_column, i) => {
        const xPos = margin + i * columnWidth;
        doc.rect(xPos, top, columnWidth, headerRowHeight + 1, 'F');
      });
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(headerFontSize);
      options.columns.forEach((column, i) => {
        const xPos = margin + i * columnWidth;
        const lines = doc.splitTextToSize(String(column), columnWidth - 3);
        doc.text(lines, xPos + 2, top + 3.5);
      });
      return top + headerRowHeight + 2;
    };

    const resumeRowStyle = () => {
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(cellFontSize);
    };

    // Trailing sections (Observaciones, Conclusiones, Evidencias, Firmas) never
    // checked remaining page space, so on reports with little table data they
    // could run past the fixed-position footer and visually overlap it.
    const footerReserve = 30;
    const ensureSpace = (needed: number) => {
      if (yPosition + needed > pageHeight - footerReserve) {
        doc.addPage();
        yPosition = margin;
      }
    };

    yPosition = drawTableHeader(yPosition);
    resumeRowStyle();

    reportData.forEach((row, rowIndex) => {
      if (yPosition + rowHeight > pageHeight - 30) {
        doc.addPage();
        yPosition = drawTableHeader(margin + 10);
        resumeRowStyle();
      }
      const fillColor = rowIndex % 2 === 0 ? 248 : 255;
      doc.setFillColor(fillColor, fillColor, fillColor);
      options.columns.forEach((_column, i) => {
        const xPos = margin + i * columnWidth;
        doc.rect(xPos, yPosition, columnWidth, rowHeight, 'F');
      });
      options.columns.forEach((column, i) => {
        const xPos = margin + i * columnWidth;
        const rawValue = row[column];
        const cellValue =
          rawValue == null || rawValue === ''
            ? '-'
            : typeof rawValue === 'object'
              ? JSON.stringify(rawValue).slice(0, 24)
              : String(rawValue).slice(0, 24);
        const lines = doc.splitTextToSize(cellValue, columnWidth - 3);
        doc.text(lines, xPos + 1.5, yPosition + 2.2);
      });
      yPosition += rowHeight;
    });

    ensureSpace(20);
    addSectionTitle('Observaciones');
    addParagraph(options.observations || 'Sin observaciones adicionales.');

    ensureSpace(20);
    addSectionTitle('Conclusiones');
    addParagraph(options.conclusions || 'Se recomienda revisar el contenido antes de entregar el documento.');

    ensureSpace(16);
    addSectionTitle('Evidencias fotográficas');
    if (evidenceItems.length > 0) {
      evidenceItems.slice(0, 3).forEach((item, index) => {
        ensureSpace(44);
        addParagraph(`${index + 1}. ${item.title || 'Evidencia adjunta'}`);
        if (item.notes) {
          addParagraph(item.notes, margin + 4, contentWidth - 4);
        }
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(margin, yPosition, contentWidth, 26, 2, 2, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        doc.text('Antes', margin + 6, yPosition + 8);
        doc.text('Después', margin + 84, yPosition + 8);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(item.beforeUrl || 'Sin imagen registrada', margin + 6, yPosition + 16, { maxWidth: 70 });
        doc.text(item.afterUrl || 'Sin imagen registrada', margin + 84, yPosition + 16, { maxWidth: 70 });
        yPosition += 32;
      });
    } else {
      addParagraph(options.evidenceSummary || 'Incluye evidencia documental y fotográfica según el contexto del reporte.');
    }

    ensureSpace(16);
    addSectionTitle('Firmas y autorización');
    const signatureWidth = (contentWidth - 8) / 2;
    signatures.slice(0, 2).forEach((signature, index) => {
      ensureSpace(34);
      const xPos = margin + index * (signatureWidth + 8);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(xPos, yPosition, signatureWidth, 30, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(signature.label, xPos + 4, yPosition + 8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(signature.name || '—', xPos + 4, yPosition + 18);
      doc.line(xPos + 4, yPosition + 24, xPos + signatureWidth - 4, yPosition + 24);
      yPosition += 34;
    });

    // Stamp the same footer (with per-page number) on every page, not just the
    // last one - table/section pagination above can produce several pages.
    const pageCount = (doc as { internal?: { getNumberOfPages?: () => number } }).internal?.getNumberOfPages?.() ?? 1;
    // Same source as the header logo (this company's own logo, or the
    // neutral EmpresaOS mark) - never a different, hardcoded company's asset.
    const watermarkImage = logoImage;
    const watermarkAspect = await getImageAspect(watermarkImage);
    for (let i = 1; i <= pageCount; i += 1) {
      doc.setPage(i);
      if (watermarkImage) {
        drawWatermark(doc, watermarkImage, watermarkAspect, pageWidth, pageHeight);
      }
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.4);
      doc.line(margin, pageHeight - 24, pageWidth - margin, pageHeight - 24);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`Documento generado por ${options.companyName || 'la empresa'} · ${options.generatedDate || formatDateTime(new Date())}`, margin, pageHeight - 16);
      doc.text('Confidencial · Uso interno o para presentación al cliente', pageWidth - margin, pageHeight - 16, { align: 'right' });
      doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 16, { align: 'center' });
    }

    const pdfBuffer = doc.output('arraybuffer');
    const totalPages = pageCount;

    console.log('REPORT_PDF_GENERATION_SUCCESS', {
      recordCount: reportData.length,
      bufferSize: pdfBuffer.byteLength,
      pages: totalPages,
    });

    return Buffer.from(pdfBuffer as unknown as ArrayBufferLike);
  } catch (error) {
    console.error('REPORT_PDF_GENERATION_ERROR', {
      error: error instanceof Error ? error.message : String(error),
      recordCount: reportData.length,
    });
    throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export type TechnicalReportEvidenceItem = {
  title?: string;
  beforeUrl?: string | null;
  afterUrl?: string | null;
};

export type TechnicalReportData = {
  reportDate?: string;
  clientName?: string;
  clientContact?: string;
  projectName?: string;
  projectLocation?: string;
  equipmentName?: string;
  assetCode?: string;
  assetBrandModel?: string;
  equipmentStatusLabel?: string;
  responsibleName?: string;
  technicianName?: string;
  activityTypeLabel?: string;
  problemDescription?: string;
  diagnosis?: string;
  workActivity?: string;
  procedure?: string;
  materialsUsed?: string;
  sparePartsUsed?: string;
  observations?: string;
  recommendations?: string;
  evidenceItems?: TechnicalReportEvidenceItem[];
  technicalSignatureImage?: string | null;
  technicalSignatureName?: string;
  technicalSignatureRole?: string;
  technicalSignatureDate?: string;
  clientSignatureImage?: string | null;
  clientSignatureName?: string;
  clientSignatureRole?: string;
  clientSignatureDate?: string;
};

/**
 * Generate Technical Report PDF
 * Professional client-facing document for a maintenance service visit:
 * client/project/equipment info, responsible/technician, diagnosis and
 * work performed, materials, one-or-more before/after evidence pairs and
 * hand-drawn signatures with role and date.
 */
export async function generateTechnicalPdf(
  reportData: TechnicalReportData,
  options: {
    companyName?: string;
    companyLogoUrl?: string;
    companyPhone?: string;
    companyEmail?: string;
    companyWebsite?: string;
    generatedDate?: string;
    reportCode?: string;
  }
): Promise<Buffer> {
  try {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    const footerReserve = 22;

    const evidenceItems = (reportData.evidenceItems || []).filter((item) => item.beforeUrl || item.afterUrl);

    const [logoImage, technicianSignatureImage, clientSignatureImage, resolvedEvidence] = await Promise.all([
      resolveImageAsBase64(options.companyLogoUrl || DEFAULT_LOGO_PATH),
      resolveImageAsBase64(reportData.technicalSignatureImage),
      resolveImageAsBase64(reportData.clientSignatureImage),
      Promise.all(
        evidenceItems.map(async (item) => ({
          title: item.title,
          before: await resolveImageAsBase64(item.beforeUrl),
          after: await resolveImageAsBase64(item.afterUrl),
        }))
      ),
    ]);
    // Same source as the header logo (this company's own logo, or the
    // neutral EmpresaOS mark) - never a different, hardcoded company's asset.
    const watermarkImage = logoImage;
    const watermarkAspect = await getImageAspect(watermarkImage);

    const drawHeader = () => {
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 40, 'F');
      doc.setFillColor(15, 118, 110);
      doc.rect(0, 40, pageWidth, 1.4, 'F');

      try {
        if (!logoImage) throw new Error('No logo available');
        doc.addImage(logoImage, margin, 7, 18, 18);
      } catch {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(margin, 7, 18, 18, 2, 2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text((options.companyName || 'E').slice(0, 2).toUpperCase(), margin + 9, 18, { align: 'center' });
      }

      const textX = margin + 23;
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text((options.companyName || 'Empresa').toUpperCase(), textX, 12);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`N.° de informe: ${options.reportCode || 'SIN-CODIGO'}`, pageWidth - margin, 12, { align: 'right' });

      doc.setFontSize(13.5);
      doc.text('INFORME TÉCNICO DE MANTENIMIENTO', textX, 21);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('Documento entregable al cliente', textX, 28);
      doc.setFontSize(7.6);
      doc.text(`Fecha de generación: ${options.generatedDate || formatDateTime(new Date())}`, pageWidth - margin, 28, { align: 'right' });

      return 48;
    };

    const drawFooter = () => {
      if (watermarkImage) {
        drawWatermark(doc, watermarkImage, watermarkAspect, pageWidth, pageHeight);
      }
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.4);
      doc.line(margin, pageHeight - 16, pageWidth - margin, pageHeight - 16);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.6);
      doc.setTextColor(15, 23, 42);
      doc.text(options.companyName || 'Empresa', margin, pageHeight - 10);
      const contactParts = [options.companyPhone, options.companyEmail, options.companyWebsite].filter(Boolean);
      if (contactParts.length) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.4);
        doc.setTextColor(100, 116, 139);
        doc.text(contactParts.join('  ·  '), margin, pageHeight - 6);
      }
    };

    let yPosition = drawHeader();

    const ensureSpace = (needed: number) => {
      if (yPosition + needed > pageHeight - footerReserve) {
        drawFooter();
        doc.addPage();
        yPosition = drawHeader();
      }
    };

    const addSectionBar = (title: string, color: [number, number, number] = [15, 118, 110]) => {
      ensureSpace(11);
      doc.setFillColor(color[0], color[1], color[2]);
      doc.roundedRect(margin, yPosition, contentWidth, 7, 1, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text(title, margin + 3, yPosition + 4.8);
      yPosition += 11;
    };

    const addField = (label: string, value: string, x: number, width: number, height = 14) => {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(x, yPosition, width, height, 1.2, 1.2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.8);
      doc.setTextColor(15, 23, 42);
      doc.text(label, x + 2.4, yPosition + 4.2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.6);
      doc.setTextColor(51, 65, 85);
      const lines = doc.splitTextToSize(value || '—', width - 4.8);
      doc.text(lines, x + 2.4, yPosition + 9, { baseline: 'middle' });
    };

    const addFieldRow = (fields: Array<{ label: string; value: string; width: number }>) => {
      ensureSpace(16);
      let x = margin;
      fields.forEach((field) => {
        addField(field.label, field.value, x, field.width);
        x += field.width + 2;
      });
      yPosition += 16;
    };

    const addParagraphSection = (title: string, value: string) => {
      const text = value?.trim() || 'Sin información registrada.';
      const splitText = doc.splitTextToSize(text, contentWidth - 6);
      addSectionBar(title);
      ensureSpace(splitText.length * 4.2 + 4);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      doc.text(splitText, margin + 3, yPosition + 2);
      yPosition += splitText.length * 4.2 + 6;
    };

    // ---- Información del cliente ----
    addSectionBar('Información del cliente');
    addFieldRow([
      { label: 'Fecha', value: reportData.reportDate || new Date().toISOString().slice(0, 10), width: 40 },
      { label: 'Cliente', value: reportData.clientName || '—', width: (contentWidth - 40 - 4) / 2 },
      { label: 'Contacto', value: reportData.clientContact || '—', width: (contentWidth - 40 - 4) / 2 },
    ]);

    // ---- Información del proyecto y del activo/equipo ----
    addSectionBar('Información del proyecto y equipo intervenido');
    addFieldRow([
      { label: 'Proyecto / Obra', value: reportData.projectName || '—', width: (contentWidth - 2) / 2 },
      { label: 'Ubicación / Sede', value: reportData.projectLocation || '—', width: (contentWidth - 2) / 2 },
    ]);
    addFieldRow([
      { label: 'Equipo intervenido', value: [reportData.equipmentName, reportData.assetCode].filter(Boolean).join(' · ') || '—', width: (contentWidth - 2) / 2 },
      { label: 'Marca / Modelo', value: reportData.assetBrandModel || '—', width: (contentWidth - 2) / 2 },
    ]);
    addFieldRow([
      { label: 'Estado del equipo', value: reportData.equipmentStatusLabel || '—', width: (contentWidth - 2) / 2 },
      { label: 'Tipo de mantenimiento', value: reportData.activityTypeLabel || '—', width: (contentWidth - 2) / 2 },
    ]);

    // ---- Responsables ----
    addSectionBar('Responsables del servicio');
    addFieldRow([
      { label: 'Responsable del mantenimiento', value: reportData.responsibleName || '—', width: (contentWidth - 2) / 2 },
      { label: 'Técnico que realizó el trabajo', value: reportData.technicianName || '—', width: (contentWidth - 2) / 2 },
    ]);

    // ---- Desarrollo del servicio ----
    addSectionBar('Desarrollo del servicio', [30, 41, 59]);
    addParagraphSection('Descripción del problema', reportData.problemDescription || '');
    addParagraphSection('Diagnóstico', reportData.diagnosis || '');
    addParagraphSection('Actividades realizadas', reportData.workActivity || '');
    addParagraphSection('Procedimiento ejecutado', reportData.procedure || '');
    addParagraphSection('Materiales utilizados', reportData.materialsUsed || '');
    addParagraphSection('Repuestos utilizados', reportData.sparePartsUsed || '');
    addParagraphSection('Observaciones', reportData.observations || '');
    addParagraphSection('Recomendaciones', reportData.recommendations || '');

    // ---- Evidencias fotográficas ----
    addSectionBar('Evidencias fotográficas');
    const evidenceHeight = 62;
    const evidenceWidth = (contentWidth - 6) / 2;
    const drawEvidenceBox = (x: number, title: string, image: string | null) => {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(x, yPosition, evidenceWidth, evidenceHeight, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(title, x + 4, yPosition + 7);
      if (image) {
        try {
          doc.addImage(image, x + 4, yPosition + 10, evidenceWidth - 8, evidenceHeight - 14);
          return;
        } catch {
          // fall through to placeholder text below
        }
      }
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text('Sin imagen registrada', x + evidenceWidth / 2, yPosition + evidenceHeight / 2, { align: 'center' });
    };

    if (resolvedEvidence.length > 0) {
      resolvedEvidence.forEach((item, index) => {
        ensureSpace(evidenceHeight + 10);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        doc.text(item.title || `Registro fotográfico ${index + 1}`, margin, yPosition + 3);
        yPosition += 6;
        drawEvidenceBox(margin, 'Antes', item.before);
        drawEvidenceBox(margin + evidenceWidth + 6, 'Después', item.after);
        yPosition += evidenceHeight + 6;
      });
    } else {
      ensureSpace(evidenceHeight + 4);
      drawEvidenceBox(margin, 'Antes', null);
      drawEvidenceBox(margin + evidenceWidth + 6, 'Después', null);
      yPosition += evidenceHeight + 6;
    }

    // ---- Firmas ----
    addSectionBar('Firmas y autorización');
    const signatureHeight = 40;
    ensureSpace(signatureHeight + 4);
    const signatureWidth = (contentWidth - 6) / 2;
    const drawSignatureBox = (
      x: number,
      label: string,
      name: string,
      role: string,
      date: string,
      image: string | null
    ) => {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(x, yPosition, signatureWidth, signatureHeight, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(label, x + 4, yPosition + 7);
      if (image) {
        try {
          doc.addImage(image, x + 4, yPosition + 9, signatureWidth - 8, 15);
        } catch {
          // ignore malformed signature image, the name/line below is still shown
        }
      }
      doc.setDrawColor(148, 163, 184);
      doc.line(x + 4, yPosition + 26, x + signatureWidth - 4, yPosition + 26);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.6);
      doc.setTextColor(15, 23, 42);
      doc.text(`Nombre: ${name || 'Sin firmar'}`, x + 4, yPosition + 30.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(`Cargo: ${role || '—'}`, x + 4, yPosition + 34.5);
      doc.text(`Fecha: ${date || '—'}`, x + 4, yPosition + 38.5);
    };
    drawSignatureBox(
      margin,
      'Firma del técnico',
      reportData.technicalSignatureName || reportData.technicianName || '',
      reportData.technicalSignatureRole || '',
      reportData.technicalSignatureDate || reportData.reportDate || '',
      technicianSignatureImage
    );
    drawSignatureBox(
      margin + signatureWidth + 6,
      'Firma del cliente',
      reportData.clientSignatureName || reportData.clientContact || '',
      reportData.clientSignatureRole || '',
      reportData.clientSignatureDate || reportData.reportDate || '',
      clientSignatureImage
    );
    yPosition += signatureHeight + 4;

    drawFooter();

    const totalPages = (doc as { internal?: { getNumberOfPages?: () => number } }).internal?.getNumberOfPages?.() ?? 1;
    for (let i = 1; i <= totalPages; i += 1) {
      doc.setPage(i);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.6);
      doc.setTextColor(100, 116, 139);
      doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
    }

    const pdfBuffer = doc.output('arraybuffer');
    return Buffer.from(pdfBuffer as unknown as ArrayBufferLike);
  } catch (error) {
    console.error('TECHNICAL_PDF_GENERATION_ERROR', error);
    throw new Error('No fue posible generar el PDF técnico.');
  }
}

export async function generateExcel(
  reportData: Record<string, unknown>[],
  options: {
    title: string;
    columns: string[];
    companyName?: string;
    reportType?: string;
    generatedDate?: string;
  }
): Promise<Buffer> {
  try {
    console.log('REPORT_EXCEL_GENERATION_START', {
      recordCount: reportData.length,
      columns: options.columns.length,
      title: options.title,
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Reporte');

    // Set column widths
    const columnWidths = options.columns.map(() => 18);
    worksheet.columns = columnWidths.map((width, i) => ({
      header: options.columns[i],
      width,
    }));

    // Header row styling
    const headerRow = worksheet.getRow(1);
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2980B9' }, // Blue
    };
    headerRow.font = {
      bold: true,
      color: { argb: 'FFFFFFFF' }, // White
      size: 11,
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

    // Add data rows
    reportData.forEach((row) => {
      const values = options.columns.map((column) => {
        const value = row[column];
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        return value;
      });
      worksheet.addRow(values);
    });

    // Add metadata sheet
    const metadataSheet = workbook.addWorksheet('Metadata');
    metadataSheet.columns = [
      { header: 'Propiedad', width: 20 },
      { header: 'Valor', width: 40 },
    ];

    const metadataRows = [
      ['Título', options.title],
      ['Empresa', options.companyName || '-'],
      ['Tipo', options.reportType || '-'],
      ['Generado', options.generatedDate || formatDateTime(new Date())],
      ['Total de registros', reportData.length.toString()],
    ];

    metadataRows.forEach((row) => {
      metadataSheet.addRow(row);
    });

    // Style metadata sheet
    const metadataHeaderRow = metadataSheet.getRow(1);
    metadataHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2980B9' },
    };
    metadataHeaderRow.font = {
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    console.log('REPORT_EXCEL_GENERATION_SUCCESS', {
      recordCount: reportData.length,
      bufferSize: buffer.byteLength,
      sheets: workbook.worksheets.length,
    });

    return Buffer.from(buffer as unknown as Uint8Array);
  } catch (error) {
    console.error('REPORT_EXCEL_GENERATION_ERROR', {
      error: error instanceof Error ? error.message : String(error),
      recordCount: reportData.length,
    });
    throw new Error(`Failed to generate Excel: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
