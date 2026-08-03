import "server-only";
import { Resend } from "resend";

let client: Resend | null = null;
let warnedMissingKey = false;

function getClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (!warnedMissingKey) {
      console.warn("RESEND_API_KEY no está configurada; los recordatorios por correo se omiten (solo in-app).");
      warnedMissingKey = true;
    }
    return null;
  }
  if (!client) {
    client = new Resend(apiKey);
  }
  return client;
}

/**
 * Fully optional: if RESEND_API_KEY isn't set, this no-ops (logs once) rather
 * than throwing, so email delivery is never a hard dependency for the rest
 * of the app - in-app notifications still work with zero email config.
 */
export async function sendReminderEmail(params: { to: string; subject: string; html: string }) {
  const resend = getClient();
  if (!resend) return { sent: false };

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "EmpresaOS <notificaciones@resend.dev>",
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    return { sent: true };
  } catch (error) {
    console.warn("RESEND_SEND_FAILED", { error: error instanceof Error ? error.message : String(error) });
    return { sent: false };
  }
}
