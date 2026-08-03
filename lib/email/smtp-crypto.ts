import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

/**
 * SMTP passwords are encrypted at the application layer (AES-256-GCM)
 * before being written to email_settings.smtp_password_encrypted, mirroring
 * lib/google/token-crypto.ts's pattern for Google refresh tokens - same
 * reasoning: keeping this out of SQL means the secret never touches
 * Postgres logs/pg_stat_statements.
 */
function getKey(): Buffer {
  const secret = process.env.SMTP_CREDENTIALS_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("SMTP_CREDENTIALS_ENCRYPTION_KEY no está configurada.");
  }
  return scryptSync(secret, "smtp-credentials", 32);
}

export function encryptSmtpPassword(plainText: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptSmtpPassword(encoded: string): string {
  const raw = Buffer.from(encoded, "base64");
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
