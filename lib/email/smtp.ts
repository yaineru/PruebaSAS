import "server-only";
import nodemailer from "nodemailer";
import { decryptSmtpPassword } from "@/lib/email/smtp-crypto";

export type SmtpConfig = {
  host: string;
  port: number;
  user: string | null;
  passwordEncrypted: string | null;
  secure: boolean;
  fromEmail: string;
  fromName: string | null;
  replyTo: string | null;
  timeoutMs: number;
};

export type SendResult = { ok: true } | { ok: false; error: string };

function buildTransport(config: SmtpConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user ? { user: config.user, pass: config.passwordEncrypted ? decryptSmtpPassword(config.passwordEncrypted) : "" } : undefined,
    connectionTimeout: config.timeoutMs,
    greetingTimeout: config.timeoutMs,
    socketTimeout: config.timeoutMs
  });
}

// Belt-and-suspenders on top of nodemailer's own connection/greeting/socket
// timeouts: a hang while testing against a local dev SMTP server showed
// those internal timeouts aren't always sufficient to bound the call in
// practice (e.g. a server that accepts the connection but never completes
// the DATA phase). This wrapper guarantees sendViaSmtp/verifySmtpConnection
// always settle within timeoutMs + 2s, no matter what the socket does.
function withHardTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Tiempo de espera agotado (${label}).`)), timeoutMs + 2000);
  });
  // Clearing the timer once either side settles avoids leaking a live
  // handle per call - with many calls in a short window (e.g. a queue
  // drain processing dozens of rows) those otherwise pile up as pending
  // timers for the outstanding duration of each one.
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function sendViaSmtp(
  config: SmtpConfig,
  message: { to: string; cc?: string; subject: string; html: string; attachments?: Array<{ filename: string; content: Buffer }> }
): Promise<SendResult> {
  try {
    const transport = buildTransport(config);
    const from = config.fromName ? `${config.fromName} <${config.fromEmail}>` : config.fromEmail;
    await withHardTimeout(
      transport.sendMail({
        from,
        to: message.to,
        cc: message.cc || undefined,
        subject: message.subject,
        html: message.html,
        replyTo: config.replyTo || undefined,
        attachments: message.attachments
      }),
      config.timeoutMs,
      "envío SMTP"
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Error desconocido enviando el correo." };
  }
}

export async function verifySmtpConnection(config: SmtpConfig): Promise<SendResult> {
  try {
    const transport = buildTransport(config);
    await withHardTimeout(transport.verify(), config.timeoutMs, "conexión SMTP");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo conectar al servidor SMTP." };
  }
}
