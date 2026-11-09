"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant";
import { assertRateLimit, assertSameOrigin, sanitizeText } from "@/lib/security";
import { coerceEnumValue } from "@/lib/enums";
import { trackAnalyticsEvent } from "@/lib/actions/notifications";

export type AssetHistoryActionState = {
  success: boolean;
  message?: string;
  error?: string;
};

const uuidSchema = z.string().uuid();
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha no tiene un formato válido.");

function failure(error: string): AssetHistoryActionState {
  return { success: false, error };
}

// getTenantContext() redirige (a /login o /suspendida) cuando no hay sesión
// válida, y next/navigation implementa redirect() LANZANDO un error especial.
// Un `catch` que lo trate como un fallo cualquiera anula la redirección y le
// muestra al usuario "no se pudo guardar" cuando lo que pasó es que se le
// venció la sesión. Se reconoce por su `digest` y se vuelve a lanzar para que
// Next lo maneje.
function rethrowIfNavigation(error: unknown) {
  const digest = (error as { digest?: unknown } | null)?.digest;
  if (typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND")) {
    throw error;
  }
}

// El historial libre del equipo NO pasa por el motor genérico de
// lib/actions/tenant-records.ts a propósito: ese motor deriva el payload de
// ModuleConfig.fields, y asset_history no es un módulo del menú (no tiene
// listado propio, vive dentro de la ficha de un equipo). Además necesita dos
// cosas que el motor genérico no hace: resolver el asset_id desde la URL en
// vez de un <select>, y heredar el proyecto del equipo en el momento de la
// anotación (ver más abajo).
export async function createAssetHistoryEntry(
  _previousState: AssetHistoryActionState,
  formData: FormData
): Promise<AssetHistoryActionState> {
  try {
    await assertSameOrigin();
    await assertRateLimit("asset-history-create", 30);

    const tenant = await getTenantContext();

    // Escala de permisos igual a la policy asset_history_insert
    // (can_register_operations): el operario que está frente a la máquina es
    // justamente quien sabe qué se le hizo, igual que ya puede registrar un
    // mantenimiento o una novedad. Se valida también acá para dar un mensaje
    // claro en vez de un error crudo de RLS.
    if (!["SUPER_ADMIN", "ADMIN", "SUPERVISOR", "OPERARIO"].includes(tenant.role)) {
      return failure("No tienes permisos para registrar historial de equipos.");
    }

    const assetIdResult = uuidSchema.safeParse(String(formData.get("assetId") ?? ""));
    if (!assetIdResult.success) {
      return failure("El equipo indicado no es válido.");
    }
    const assetId = assetIdResult.data;

    const title = sanitizeText(formData.get("title"), 200);
    if (!title) {
      return failure("Escribe qué se le hizo al equipo.");
    }

    const description = sanitizeText(formData.get("description"), 2000, { multiline: true }) || null;
    const performedByName = sanitizeText(formData.get("performed_by_name"), 120) || null;

    let eventType: string;
    try {
      eventType = coerceEnumValue("assetHistoryEventType", formData.get("event_type")) ?? "INTERVENTION";
    } catch {
      return failure("Selecciona un tipo de registro válido.");
    }

    const rawPerformedAt = String(formData.get("performed_at") ?? "").trim();
    let performedAt = new Date().toISOString().slice(0, 10);
    if (rawPerformedAt) {
      const parsed = isoDateSchema.safeParse(rawPerformedAt);
      if (!parsed.success) return failure("La fecha no tiene un formato válido.");
      // Una intervención es algo que YA se hizo; una fecha futura aquí es
      // casi siempre un error de tipeo en el año, y el timeline la dejaría
      // clavada arriba de todo para siempre.
      if (parsed.data > performedAt) {
        return failure("La fecha de la intervención no puede estar en el futuro.");
      }
      performedAt = parsed.data;
    }

    const cost = parseOptionalNumber(formData.get("cost"));
    if (cost === "invalid" || (typeof cost === "number" && cost < 0)) {
      return failure("El costo debe ser un número mayor o igual a cero.");
    }

    const hourMeter = parseOptionalNumber(formData.get("hour_meter"));
    if (hourMeter === "invalid" || (typeof hourMeter === "number" && hourMeter < 0)) {
      return failure("El horómetro debe ser un número mayor o igual a cero.");
    }

    const supabase = await createClient();

    // Doble propósito: confirma que el equipo es de esta empresa (la misma
    // comprobación que hace FK_TABLE_BY_FIELD en el motor genérico) y trae su
    // proyecto actual para guardarlo EN la entrada. Se congela aquí porque un
    // equipo cambia de obra: si la ficha leyera assets.project_id al mostrar
    // el historial, todas las intervenciones pasadas aparecerían como hechas
    // en la obra de hoy.
    const { data: asset, error: assetError } = await supabase
      .from("assets")
      .select("id,project_id")
      .eq("id", assetId)
      .eq("company_id", tenant.companyId)
      .maybeSingle();

    if (assetError || !asset) {
      return failure("El equipo no existe o no pertenece a tu empresa.");
    }

    const { error } = await supabase.from("asset_history").insert({
      company_id: tenant.companyId,
      asset_id: assetId,
      project_id: asset.project_id ?? null,
      event_type: eventType,
      title,
      description,
      performed_at: performedAt,
      performed_by_name: performedByName,
      hour_meter: typeof hourMeter === "number" ? hourMeter : null,
      cost: typeof cost === "number" ? cost : 0,
      created_by: tenant.userId
    });

    if (error) {
      console.error("Asset history insert failed", {
        assetId,
        code: error.code,
        message: error.message
      });
      // 42P01 = la tabla no existe todavía: la migración 047 no se aplicó.
      if (error.code === "42P01") {
        return failure("El historial de equipos aún no está habilitado en la base de datos (falta aplicar la migración 047).");
      }
      return failure("No se pudo guardar la entrada del historial. Intenta de nuevo.");
    }

    await trackAnalyticsEvent("CREATE_ASSET_HISTORY");
    revalidatePath(`/activos/${assetId}`);
    return { success: true, message: "Entrada agregada al historial del equipo." };
  } catch (error) {
    rethrowIfNavigation(error);
    console.error("Asset history action failed", {
      message: error instanceof Error ? error.message : "Unknown error"
    });
    return failure(error instanceof Error ? error.message : "No se pudo guardar la entrada del historial.");
  }
}

export async function deleteAssetHistoryEntry(entryId: string, assetId: string): Promise<AssetHistoryActionState> {
  try {
    await assertSameOrigin();
    await assertRateLimit("asset-history-delete", 30);

    const tenant = await getTenantContext();

    // Misma escala que la policy asset_history_delete (can_manage_company):
    // borrar historial es destruir el rastro de lo que se le hizo a la
    // máquina, así que queda en ADMIN/SUPER_ADMIN - nunca en quien lo anotó.
    if (!["SUPER_ADMIN", "ADMIN"].includes(tenant.role)) {
      return failure("Solo un administrador puede eliminar entradas del historial.");
    }

    const entryIdResult = uuidSchema.safeParse(entryId);
    const assetIdResult = uuidSchema.safeParse(assetId);
    if (!entryIdResult.success || !assetIdResult.success) {
      return failure("La entrada indicada no es válida.");
    }

    const supabase = await createClient();
    const { data: deleted, error } = await supabase
      .from("asset_history")
      .delete()
      .eq("id", entryIdResult.data)
      .eq("company_id", tenant.companyId)
      .select("id");

    if (error) {
      console.error("Asset history delete failed", { entryId, code: error.code, message: error.message });
      return failure("No se pudo eliminar la entrada del historial.");
    }

    if (!deleted || deleted.length === 0) {
      return failure("La entrada ya no existe o no pertenece a tu empresa.");
    }

    revalidatePath(`/activos/${assetIdResult.data}`);
    return { success: true, message: "Entrada eliminada del historial." };
  } catch (error) {
    rethrowIfNavigation(error);
    console.error("Asset history delete action failed", {
      message: error instanceof Error ? error.message : "Unknown error"
    });
    return failure(error instanceof Error ? error.message : "No se pudo eliminar la entrada.");
  }
}

// Campo numérico opcional: "" significa "no se anotó" (se guarda NULL para el
// horómetro, 0 para el costo), pero "abc" es un error del usuario y no debe
// convertirse silenciosamente en 0 - Number("abc") da NaN, que Postgres
// rechazaría con un error ilegible.
function parseOptionalNumber(raw: FormDataEntryValue | null): number | null | "invalid" {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : "invalid";
}
