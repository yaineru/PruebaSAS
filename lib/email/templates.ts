import "server-only";

export type BrandContext = {
  companyName: string;
  primaryColor: string;
  logoUrl?: string | null;
  companyPhone?: string | null;
  companyEmail?: string | null;
  companyWebsite?: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Every transactional email shares this wrapper so branding (logo, color,
 * footer/contact) automatically follows each company's own company_settings
 * instead of being hardcoded per template.
 */
export function wrapBrandedEmail(brand: BrandContext, bodyHtml: string, preheader = ""): string {
  const color = /^#[0-9A-Fa-f]{6}$/.test(brand.primaryColor) ? brand.primaryColor : "#0f172a";
  const name = escapeHtml(brand.companyName);
  const contactLine = [brand.companyPhone, brand.companyEmail, brand.companyWebsite]
    .filter(Boolean)
    .map((value) => escapeHtml(String(value)))
    .join(" · ");

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${name}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;">
<tr><td style="background:${color};padding:20px 28px;">
${brand.logoUrl ? `<img src="${escapeHtml(brand.logoUrl)}" alt="${name}" height="32" style="display:block;" />` : `<span style="color:#ffffff;font-size:18px;font-weight:700;">${name}</span>`}
</td></tr>
<tr><td style="padding:28px;color:#1e293b;font-size:15px;line-height:1.6;">
${bodyHtml}
</td></tr>
<tr><td style="padding:18px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;">
${name}${contactLine ? ` · ${contactLine}` : ""}<br/>Notificación automática de EmpresaOS.
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function button(url: string, label: string, color: string): string {
  return `<p style="margin:24px 0;"><a href="${escapeHtml(url)}" style="background:${color};color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:6px;font-weight:600;font-size:14px;display:inline-block;">${escapeHtml(label)}</a></p>`;
}

export function activityReminderEmail(brand: BrandContext, params: { title: string; whenLabel: string; location?: string | null }) {
  const body = `
    <h1 style="margin:0 0 12px;font-size:20px;">Recordatorio de actividad</h1>
    <p><strong>${escapeHtml(params.title)}</strong> ${escapeHtml(params.whenLabel)}.</p>
    ${params.location ? `<p style="color:#64748b;">📍 ${escapeHtml(params.location)}</p>` : ""}
  `;
  return {
    subject: `Recordatorio: ${params.title}`,
    html: wrapBrandedEmail(brand, body, `Recordatorio: ${params.title}`)
  };
}

export function reportGeneratedEmail(brand: BrandContext, params: { reportLabel: string; downloadUrl: string }) {
  const body = `
    <h1 style="margin:0 0 12px;font-size:20px;">Tu informe está listo</h1>
    <p>El informe <strong>${escapeHtml(params.reportLabel)}</strong> terminó de generarse y ya puedes descargarlo.</p>
    ${button(params.downloadUrl, "Descargar informe", brand.primaryColor)}
  `;
  return {
    subject: `Informe generado: ${params.reportLabel}`,
    html: wrapBrandedEmail(brand, body, "Tu informe está listo para descargar")
  };
}

export function technicalReportGeneratedEmail(brand: BrandContext, params: { clientName: string; downloadUrl: string }) {
  const body = `
    <h1 style="margin:0 0 12px;font-size:20px;">Informe técnico generado</h1>
    <p>El informe técnico para <strong>${escapeHtml(params.clientName)}</strong> ya está disponible.</p>
    ${button(params.downloadUrl, "Descargar informe técnico", brand.primaryColor)}
  `;
  return {
    subject: `Informe técnico generado — ${params.clientName}`,
    html: wrapBrandedEmail(brand, body, "Informe técnico listo para entregar")
  };
}

export function documentExpiringEmail(brand: BrandContext, params: { documentTitle: string; expiresOnLabel: string; assetName?: string | null }) {
  const body = `
    <h1 style="margin:0 0 12px;font-size:20px;">Documento próximo a vencer</h1>
    <p><strong>${escapeHtml(params.documentTitle)}</strong>${params.assetName ? ` (${escapeHtml(params.assetName)})` : ""} vence el ${escapeHtml(params.expiresOnLabel)}.</p>
  `;
  return {
    subject: `Documento próximo a vencer: ${params.documentTitle}`,
    html: wrapBrandedEmail(brand, body, "Documento próximo a vencer")
  };
}

export function maintenanceDueEmail(brand: BrandContext, params: { assetName: string; dueDateLabel: string }) {
  const body = `
    <h1 style="margin:0 0 12px;font-size:20px;">Mantenimiento próximo</h1>
    <p><strong>${escapeHtml(params.assetName)}</strong> tiene un mantenimiento programado para el ${escapeHtml(params.dueDateLabel)}.</p>
  `;
  return {
    subject: `Mantenimiento próximo — ${params.assetName}`,
    html: wrapBrandedEmail(brand, body, "Mantenimiento próximo")
  };
}

export function reportSharedEmail(brand: BrandContext, params: { reportLabel: string; senderName: string; message?: string }) {
  const body = `
    <h1 style="margin:0 0 12px;font-size:20px;">${escapeHtml(params.senderName)} te compartió un informe</h1>
    <p><strong>${escapeHtml(params.reportLabel)}</strong> se adjunta a este correo en PDF.</p>
    ${params.message ? `<p style="white-space:pre-wrap;border-left:3px solid ${/^#[0-9A-Fa-f]{6}$/.test(brand.primaryColor) ? brand.primaryColor : "#0f172a"};padding:4px 14px;color:#334155;">${escapeHtml(params.message)}</p>` : ""}
  `;
  return {
    subject: `${params.senderName} te compartió: ${params.reportLabel}`,
    html: wrapBrandedEmail(brand, body, `Informe compartido: ${params.reportLabel}`)
  };
}

export function smtpTestEmail(brand: BrandContext) {
  const body = `
    <h1 style="margin:0 0 12px;font-size:20px;">Correo de prueba</h1>
    <p>Si estás leyendo esto, la configuración SMTP de <strong>${escapeHtml(brand.companyName)}</strong> funciona correctamente: conexión, autenticación y envío verificados.</p>
  `;
  return {
    subject: "EmpresaOS — Correo de prueba SMTP",
    html: wrapBrandedEmail(brand, body, "Correo de prueba SMTP")
  };
}
