import "server-only";
import { headers } from "next/headers";
import { z } from "zod";
import type { TenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";

// Fallback en memoria SOLO para cuando la función de base de datos todavía no
// existe (migración 042 sin aplicar) o la llamada falla por un problema de
// red puntual - nunca es la defensa principal. Un Map de proceso no sobrevive
// el modelo serverless de Vercel: cada invocación puede caer en una instancia
// distinta con su propio Map vacío, así que el límite casi nunca se acumula
// entre intentos reales. Por eso el conteo real ahora vive en Postgres
// (public.rate_limits / check_rate_limit(), ver 042_persistent_rate_limiting.sql),
// compartido entre todas las instancias.
const memoryFallback = new Map<string, { count: number; resetAt: number }>();

function checkMemoryFallback(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = memoryFallback.get(key);

  if (!entry || entry.resetAt < now) {
    memoryFallback.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

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

  try {
    const supabase = await createClient();
    const { data: allowed, error } = await supabase.rpc("check_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: Math.ceil(windowMs / 1000)
    });

    if (error) throw error;

    if (allowed === false) {
      throw new Error("Demasiadas solicitudes. Intenta de nuevo en un momento.");
    }
    return;
  } catch (error) {
    // Un límite real ya se lanzó arriba y termina aquí - repropágalo en vez
    // de tratarlo como "la función RPC no está disponible".
    if (error instanceof Error && error.message.startsWith("Demasiadas solicitudes")) {
      throw error;
    }

    console.warn("check_rate_limit RPC failed, using in-memory fallback (¿falta aplicar la migración 042?)", {
      message: error instanceof Error ? error.message : String(error)
    });

    if (!checkMemoryFallback(key, limit, windowMs)) {
      throw new Error("Demasiadas solicitudes. Intenta de nuevo en un momento.");
    }
  }
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
  // Debe coincidir exactamente con la policy RLS can_manage_company (DELETE
  // en assets/maintenance_records/incidents/projects es ADMIN/SUPER_ADMIN
  // desde 001_initial_multitenant_schema.sql) - SUPERVISOR nunca tuvo este
  // permiso ahí, a diferencia de crear/editar (can_manage_operations).
  if (role === "SUPER_ADMIN" || role === "ADMIN") return;

  throw new Error("No tienes permisos para eliminar este registro.");
}

export const primitiveFieldSchema = z
  .union([z.string(), z.number(), z.null()])
  .transform((value) => (typeof value === "string" ? sanitizeText(value, 1000) : value));
