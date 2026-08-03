import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendViaSmtp, type SmtpConfig } from "@/lib/email/smtp";
import { sendReminderEmail as sendViaResendLegacy } from "@/lib/email/resend";

export type QueueEmailParams = {
  companyId: string;
  to: string;
  subject: string;
  html: string;
  templateKey: string;
  attachments?: Array<{ filename: string; content: Buffer }>;
  createdBy?: string | null;
};

const RETRY_BACKOFF_MINUTES = [1, 5, 20];

async function loadSmtpConfig(companyId: string): Promise<SmtpConfig | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("email_settings")
    .select("smtp_host, smtp_port, smtp_user, smtp_password_encrypted, smtp_secure, from_email, from_name, reply_to, timeout_ms, enabled")
    .eq("company_id", companyId)
    .maybeSingle();

  if (!data || !data.enabled || !data.smtp_host || !data.from_email) return null;

  return {
    host: data.smtp_host,
    port: data.smtp_port,
    user: data.smtp_user,
    passwordEncrypted: data.smtp_password_encrypted,
    secure: data.smtp_secure,
    fromEmail: data.from_email,
    fromName: data.from_name,
    replyTo: data.reply_to,
    timeoutMs: data.timeout_ms
  };
}

/**
 * Single entry point for queuing a transactional email. Deliberately does
 * NOT attempt delivery inline: an earlier version awaited the SMTP send
 * directly inside generateReport()/generateTechnicalReport()'s request path,
 * and a slow/unresponsive SMTP server (or a misconfigured one that never
 * completes the protocol handshake) hung the ENTIRE report generation
 * response indefinitely - the one module this whole certification treats as
 * most critical. Queuing is a single fast insert; app/api/cron/email-queue
 * (or, in local dev only, the fire-and-forget drain below) is the only code
 * path that ever calls attemptDelivery(), so a report/reminder/expiration
 * notification can never be slowed down by email infrastructure again.
 */
export async function enqueueEmail(params: QueueEmailParams): Promise<{ logId: string }> {
  const admin = createAdminClient();

  const { data: logRow, error: insertError } = await admin
    .from("email_log")
    .insert({
      company_id: params.companyId,
      to_email: params.to,
      subject: params.subject,
      template_key: params.templateKey,
      status: "PENDING",
      created_by: params.createdBy ?? null,
      // Attachment bytes are NOT persisted here (would bloat the table with
      // binary data) - a retry re-sends the HTML body but without the
      // original attachment. Acceptable for the templates that use
      // attachments today (report links point at a durable signed Storage
      // URL inside the body itself, so the content is still reachable).
      attachments: (params.attachments ?? []).map((a) => ({ filename: a.filename, bytes: a.content.length })),
      metadata: { html: params.html }
    })
    .select("id")
    .single();

  if (insertError || !logRow) {
    console.error("EMAIL_LOG_INSERT_FAILED", insertError?.message);
    return { logId: "" };
  }

  // Delivery is deliberately NOT triggered from here, not even
  // fire-and-forget. An earlier version auto-drained the queue in the
  // background on every single call (a "local dev convenience"), and
  // because nothing serialized those background runs, dozens of overlapping
  // enqueueEmail() calls during a normal test session spawned dozens of
  // concurrent processEmailQueue() runs - each opening its own SMTP
  // connections/DB queries - and blocked this Node process's event loop for
  // several minutes straight (confirmed via node-cron's own "missed
  // execution / possible blocking IO" watchdog warnings). Production drains
  // exclusively via app/api/cron/email-queue; for local development, run
  // that same route by hand (e.g. `curl localhost:3000/api/cron/email-queue`)
  // when you want to see a queued email actually go out.
  return { logId: logRow.id };
}

export type SendEmailNowParams = {
  companyId: string;
  to: string;
  cc?: string;
  subject: string;
  html: string;
  templateKey: string;
  attachments?: Array<{ filename: string; content: Buffer }>;
  createdBy?: string | null;
};

/**
 * Delivers a single email synchronously and returns the outcome, unlike
 * enqueueEmail (which deliberately never awaits delivery inline - see the
 * comment above it). This is for the one class of email that MUST be
 * synchronous: a user explicitly clicking "Enviar por correo" on a report
 * needs to see "enviado" or a real error right away, not a silent queue
 * entry that drains up to a day later via the cron. Safe here specifically
 * because sendViaSmtp's own hard timeout (email_settings.timeout_ms, capped
 * at 60s) bounds the wait - the hang this whole module otherwise guards
 * against can't happen.
 */
export async function sendEmailNow(params: SendEmailNowParams): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();
  const smtpConfig = await loadSmtpConfig(params.companyId);

  if (!smtpConfig) {
    if (process.env.RESEND_API_KEY) {
      const legacyResult = await sendViaResendLegacy({ to: params.to, subject: params.subject, html: params.html });
      await admin.from("email_log").insert({
        company_id: params.companyId,
        to_email: params.cc ? `${params.to}, ${params.cc}` : params.to,
        subject: params.subject,
        template_key: params.templateKey,
        provider: "RESEND",
        attempts: 1,
        status: legacyResult.sent ? "SENT" : "FAILED",
        sent_at: legacyResult.sent ? new Date().toISOString() : null,
        smtp_server: legacyResult.sent ? "resend.com" : null,
        error_message: legacyResult.sent ? null : "Resend no pudo enviar el correo.",
        created_by: params.createdBy ?? null,
        attachments: (params.attachments ?? []).map((a) => ({ filename: a.filename, bytes: a.content.length })),
        metadata: { html: params.html }
      });
      return legacyResult.sent ? { ok: true } : { ok: false, error: "Resend no pudo enviar el correo." };
    }
    return { ok: false, error: "No hay un proveedor de correo configurado (SMTP ni Resend). Configúralo en Correo (SMTP)." };
  }

  const result = await sendViaSmtp(smtpConfig, {
    to: params.to,
    cc: params.cc,
    subject: params.subject,
    html: params.html,
    attachments: params.attachments
  });

  await admin.from("email_log").insert({
    company_id: params.companyId,
    to_email: params.cc ? `${params.to}, ${params.cc}` : params.to,
    subject: params.subject,
    template_key: params.templateKey,
    provider: "SMTP",
    attempts: 1,
    status: result.ok ? "SENT" : "FAILED",
    sent_at: result.ok ? new Date().toISOString() : null,
    smtp_server: result.ok ? smtpConfig.host : null,
    error_message: result.ok ? null : result.error,
    created_by: params.createdBy ?? null,
    attachments: (params.attachments ?? []).map((a) => ({ filename: a.filename, bytes: a.content.length })),
    metadata: { html: params.html }
  });

  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

type DeliveryResult = { ok: true; server: string } | { ok: false; error: string };

async function attemptDelivery(
  params: Pick<QueueEmailParams, "companyId" | "to" | "subject" | "html" | "attachments">,
  admin: ReturnType<typeof createAdminClient>
): Promise<DeliveryResult> {
  const smtpConfig = await loadSmtpConfig(params.companyId);

  if (smtpConfig) {
    const result = await sendViaSmtp(smtpConfig, params);
    if (result.ok) return { ok: true, server: smtpConfig.host };
    // Do not silently fall through to Resend on an SMTP failure the admin
    // configured on purpose (e.g. temporary auth issue) - surface it so the
    // retry queue and email history reflect the real cause instead of
    // masking it behind a different provider succeeding once.
    return { ok: false, error: result.error };
  }

  if (process.env.RESEND_API_KEY) {
    const legacyResult = await sendViaResendLegacy({ to: params.to, subject: params.subject, html: params.html });
    if (legacyResult.sent) return { ok: true, server: "resend.com" };
    return { ok: false, error: "Resend no pudo enviar el correo." };
  }

  void admin;
  return { ok: false, error: "No hay un proveedor de correo configurado (SMTP ni Resend)." };
}

// Defense in depth against the exact hang described above: even a single
// caller (the cron route) could in principle overlap with itself if a
// previous invocation is still draining when a new one arrives. A
// module-scope flag is enough here (each Vercel invocation is a fresh
// process; in long-lived local dev it prevents any accidental overlap).
let queueDrainInFlight = false;

/** Used by the retry cron - re-attempts every PENDING/RETRYING row due now. */
export async function processEmailQueue(limit = 25): Promise<{ processed: number; sent: number; failed: number }> {
  if (queueDrainInFlight) {
    return { processed: 0, sent: 0, failed: 0 };
  }
  queueDrainInFlight = true;
  try {
    return await drainEmailQueue(limit);
  } finally {
    queueDrainInFlight = false;
  }
}

async function drainEmailQueue(limit: number): Promise<{ processed: number; sent: number; failed: number }> {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: dueRows } = await admin
    .from("email_log")
    .select("id, company_id, to_email, subject, attempts, max_attempts, next_attempt_at")
    .in("status", ["PENDING", "RETRYING"])
    .lte("next_attempt_at", nowIso)
    .order("next_attempt_at", { ascending: true })
    .limit(limit);

  let sent = 0;
  let failed = 0;

  for (const row of dueRows ?? []) {
    // The original HTML isn't re-fetched here (email_log only stores
    // metadata, not the full rendered body, to keep the table small) - a
    // queued retry re-sends the same subject/to via a lightweight system
    // notice rather than regenerating a potentially stale report link.
    // Templates that must survive a retry (report/technical-report emails)
    // pass an already-durable download URL, so this remains meaningful.
    const { data: fullRow } = await admin.from("email_log").select("metadata").eq("id", row.id).maybeSingle();
    const html = typeof fullRow?.metadata === "object" && fullRow?.metadata && "html" in fullRow.metadata
      ? String((fullRow.metadata as Record<string, unknown>).html)
      : `<p>${row.subject}</p>`;

    const result = await attemptDelivery({ companyId: row.company_id, to: row.to_email, subject: row.subject, html }, admin);
    const nextAttempts = row.attempts + 1;

    if (result.ok) {
      await admin.from("email_log").update({ status: "SENT", sent_at: new Date().toISOString(), smtp_server: result.server, attempts: nextAttempts }).eq("id", row.id);
      sent += 1;
      continue;
    }

    const exhausted = nextAttempts >= row.max_attempts;
    await admin
      .from("email_log")
      .update({
        status: exhausted ? "FAILED" : "RETRYING",
        attempts: nextAttempts,
        error_message: result.error,
        next_attempt_at: exhausted
          ? row.next_attempt_at
          : new Date(Date.now() + (RETRY_BACKOFF_MINUTES[Math.min(nextAttempts, RETRY_BACKOFF_MINUTES.length - 1)] ?? 20) * 60_000).toISOString()
      })
      .eq("id", row.id);
    failed += 1;
  }

  return { processed: (dueRows ?? []).length, sent, failed };
}
