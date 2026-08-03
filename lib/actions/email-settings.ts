"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant";
import { assertSameOrigin, assertRateLimit, sanitizeText } from "@/lib/security";
import { encryptSmtpPassword } from "@/lib/email/smtp-crypto";
import { verifySmtpConnection, sendViaSmtp } from "@/lib/email/smtp";
import { getCompanySettings } from "@/lib/company-settings";
import { smtpTestEmail } from "@/lib/email/templates";

export type EmailSettingsActionState = { success: boolean; message?: string; error?: string };

function requireAdmin(role: string) {
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    throw new Error("Solo un administrador puede configurar el correo SMTP.");
  }
}

export async function saveEmailSettings(
  _previousState: EmailSettingsActionState,
  formData: FormData
): Promise<EmailSettingsActionState> {
  try {
    await assertSameOrigin();
    await assertRateLimit("email-settings-save", 20);

    const tenant = await getTenantContext();
    requireAdmin(tenant.role);

    if (!process.env.SMTP_CREDENTIALS_ENCRYPTION_KEY) {
      return {
        success: false,
        error: "El servidor no tiene configurada SMTP_CREDENTIALS_ENCRYPTION_KEY. Pide al administrador del sistema que la agregue antes de guardar credenciales SMTP."
      };
    }

    const host = sanitizeText(formData.get("smtp_host"), 255);
    const port = Number(formData.get("smtp_port")) || 587;
    const user = sanitizeText(formData.get("smtp_user"), 255);
    const password = String(formData.get("smtp_password") ?? "");
    const secure = formData.get("smtp_secure") === "true";
    const fromEmail = sanitizeText(formData.get("from_email"), 255);
    const fromName = sanitizeText(formData.get("from_name"), 120);
    const replyTo = sanitizeText(formData.get("reply_to"), 255);
    const timeoutMs = Math.min(Math.max(Number(formData.get("timeout_ms")) || 10000, 2000), 60000);
    const maxRetries = Math.min(Math.max(Number(formData.get("max_retries")) || 3, 1), 10);
    const enabled = formData.get("enabled") === "true";

    if (enabled && (!host || !fromEmail)) {
      return { success: false, error: "Host SMTP y correo remitente son obligatorios para activar el envío." };
    }

    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("email_settings")
      .select("id, smtp_password_encrypted")
      .eq("company_id", tenant.companyId)
      .maybeSingle();

    const payload = {
      company_id: tenant.companyId,
      smtp_host: host || null,
      smtp_port: port,
      smtp_user: user || null,
      smtp_password_encrypted: password ? encryptSmtpPassword(password) : existing?.smtp_password_encrypted ?? null,
      smtp_secure: secure,
      from_email: fromEmail || null,
      from_name: fromName || null,
      reply_to: replyTo || null,
      timeout_ms: timeoutMs,
      max_retries: maxRetries,
      enabled
    };

    const { error } = existing
      ? await supabase.from("email_settings").update(payload).eq("id", existing.id)
      : await supabase.from("email_settings").insert(payload);

    if (error) {
      console.error("Email settings save failed", error.message);
      return { success: false, error: "No se pudo guardar la configuración SMTP." };
    }

    revalidatePath("/settings/email");
    return { success: true, message: "Configuración SMTP guardada correctamente." };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo guardar la configuración." };
  }
}

export async function sendTestEmail(
  _previousState: EmailSettingsActionState,
  formData: FormData
): Promise<EmailSettingsActionState> {
  try {
    await assertSameOrigin();
    await assertRateLimit("email-settings-test", 10);

    const tenant = await getTenantContext();
    requireAdmin(tenant.role);

    const testRecipient = sanitizeText(formData.get("test_recipient"), 255);
    if (!testRecipient) {
      return { success: false, error: "Indica un correo destino para la prueba." };
    }

    const supabase = await createClient();
    const { data: settings } = await supabase
      .from("email_settings")
      .select("smtp_host, smtp_port, smtp_user, smtp_password_encrypted, smtp_secure, from_email, from_name, reply_to, timeout_ms")
      .eq("company_id", tenant.companyId)
      .maybeSingle();

    if (!settings?.smtp_host || !settings.from_email) {
      return { success: false, error: "Completa y guarda el host y el correo remitente antes de probar." };
    }

    const connectionCheck = await verifySmtpConnection({
      host: settings.smtp_host,
      port: settings.smtp_port,
      user: settings.smtp_user,
      passwordEncrypted: settings.smtp_password_encrypted,
      secure: settings.smtp_secure,
      fromEmail: settings.from_email,
      fromName: settings.from_name,
      replyTo: settings.reply_to,
      timeoutMs: settings.timeout_ms
    });

    if (!connectionCheck.ok) {
      await supabase
        .from("email_settings")
        .update({ last_test_at: new Date().toISOString(), last_test_ok: false, last_test_error: connectionCheck.error })
        .eq("company_id", tenant.companyId);
      return { success: false, error: `Falló la conexión SMTP: ${connectionCheck.error}` };
    }

    const companySettings = await getCompanySettings(tenant.companyId, tenant.companyName);
    const { subject, html } = smtpTestEmail({
      companyName: companySettings.companyName,
      primaryColor: companySettings.primaryColor,
      logoUrl: companySettings.logoUrl
    });

    const sendResult = await sendViaSmtp(
      {
        host: settings.smtp_host,
        port: settings.smtp_port,
        user: settings.smtp_user,
        passwordEncrypted: settings.smtp_password_encrypted,
        secure: settings.smtp_secure,
        fromEmail: settings.from_email,
        fromName: settings.from_name,
        replyTo: settings.reply_to,
        timeoutMs: settings.timeout_ms
      },
      { to: testRecipient, subject, html }
    );

    await supabase
      .from("email_settings")
      .update({
        last_test_at: new Date().toISOString(),
        last_test_ok: sendResult.ok,
        last_test_error: sendResult.ok ? null : sendResult.error
      })
      .eq("company_id", tenant.companyId);

    if (!sendResult.ok) {
      return { success: false, error: `Conexión exitosa, pero el envío falló: ${sendResult.error}` };
    }

    return { success: true, message: `Correo de prueba enviado a ${testRecipient}.` };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo enviar el correo de prueba." };
  }
}

export async function retryEmailLogEntry(logId: string): Promise<EmailSettingsActionState> {
  try {
    await assertSameOrigin();
    const tenant = await getTenantContext();
    requireAdmin(tenant.role);

    const supabase = await createClient();
    const { error } = await supabase
      .from("email_log")
      .update({ status: "RETRYING", next_attempt_at: new Date().toISOString() })
      .eq("id", logId)
      .eq("company_id", tenant.companyId);

    if (error) return { success: false, error: "No se pudo programar el reintento." };

    revalidatePath("/settings/email");
    return { success: true, message: "Reintento programado." };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo reintentar." };
  }
}
