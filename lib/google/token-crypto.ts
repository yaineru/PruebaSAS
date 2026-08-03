import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

/**
 * Google refresh/access tokens are encrypted at the application layer
 * (AES-256-GCM) before being written to google_calendar_connections -
 * deliberately not pgcrypto/pgp_sym_encrypt in SQL, since that would put the
 * encryption secret into every query and into Postgres logs/pg_stat_statements.
 *
 * GOOGLE_TOKEN_ENCRYPTION_KEY can be any non-empty string; scrypt derives a
 * proper 32-byte AES key from it so the env var itself doesn't need to be a
 * hex-formatted key.
 */
function getKey(): Buffer {
  const secret = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY is not configured");
  }
  return scryptSync(secret, "google-calendar-tokens", 32);
}

export function encryptToken(plainText: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptToken(encoded: string): string {
  const raw = Buffer.from(encoded, "base64");
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
