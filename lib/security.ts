import "server-only";
import { headers } from "next/headers";
import { z } from "zod";
import type { TenantContext } from "@/lib/tenant";

const attempts = new Map<string, { count: number; resetAt: number }>();

export function sanitizeText(value: unknown, max = 500) {
  const text = String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();

  return text.length > max ? text.slice(0, max) : text;
}

export async function assertRateLimit(scope: string, limit = 20, windowMs = 60_000) {
  const headersList = await headers();
  const forwardedFor = headersList.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwardedFor || headersList.get("x-real-ip") || "local";
  const key = `${scope}:${ip}`;
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (entry.count >= limit) {
    throw new Error("Demasiadas solicitudes. Intenta de nuevo en un momento.");
  }

  entry.count += 1;
}

export async function assertSameOrigin() {
  const headersList = await headers();
  const origin = headersList.get("origin");
  const host = headersList.get("host");

  if (!origin || !host) return;

  const originHost = new URL(origin).host;
  if (originHost !== host) {
    throw new Error("Origen de solicitud no permitido.");
  }
}

export function assertCanCreate(table: string, tenant: TenantContext) {
  const role = tenant.role;
  const adminTables = new Set(["users"]);
  const operationTables = new Set(["assets", "projects", "asset_documents"]);
  const registerTables = new Set(["maintenance_records", "incidents"]);

  if (role === "SUPER_ADMIN" || role === "ADMIN") return;
  if (role === "SUPERVISOR" && (operationTables.has(table) || registerTables.has(table))) return;
  if (role === "OPERARIO" && registerTables.has(table)) return;
  if (adminTables.has(table)) throw new Error("No tienes permisos para administrar usuarios.");

  throw new Error("No tienes permisos para realizar esta acción.");
}

export function assertCanDelete(table: string, tenant: TenantContext) {
  const role = tenant.role;
  const deletableTables = new Set(["assets", "maintenance_records", "incidents", "projects"]);

  if (!deletableTables.has(table)) {
    throw new Error("Este tipo de registro no se puede eliminar desde aquí.");
  }
  if (role === "SUPER_ADMIN" || role === "ADMIN" || role === "SUPERVISOR") return;

  throw new Error("No tienes permisos para eliminar este registro.");
}

export const primitiveFieldSchema = z
  .union([z.string(), z.number(), z.null()])
  .transform((value) => (typeof value === "string" ? sanitizeText(value, 1000) : value));
