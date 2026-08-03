"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant";
import { assertSameOrigin, assertRateLimit } from "@/lib/security";

export type CalendarShareActionState = { success: boolean; message?: string; error?: string };

async function ensureShareRow(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, companyId: string) {
  const { data: existing } = await supabase.from("calendar_share_links").select("id").eq("user_id", userId).maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("calendar_share_links")
    .insert({ user_id: userId, company_id: companyId })
    .select("id")
    .single();

  if (error || !created) throw new Error("No se pudo crear el enlace de calendario.");
  return created.id;
}

export async function toggleIcsFeed(
  _previousState: CalendarShareActionState,
  formData: FormData
): Promise<CalendarShareActionState> {
  try {
    await assertSameOrigin();
    await assertRateLimit("calendar-share-toggle", 20);
    const tenant = await getTenantContext();
    const supabase = await createClient();

    await ensureShareRow(supabase, tenant.userId, tenant.companyId);
    const enabled = formData.get("enabled") === "true";

    const { error } = await supabase.from("calendar_share_links").update({ ics_enabled: enabled }).eq("user_id", tenant.userId);
    if (error) return { success: false, error: "No se pudo actualizar el feed de calendario." };

    revalidatePath("/agenda");
    return { success: true, message: enabled ? "Feed de calendario (.ics) activado." : "Feed de calendario desactivado." };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error inesperado." };
  }
}

export async function updatePublicAvailability(
  _previousState: CalendarShareActionState,
  formData: FormData
): Promise<CalendarShareActionState> {
  try {
    await assertSameOrigin();
    await assertRateLimit("calendar-share-toggle", 20);
    const tenant = await getTenantContext();
    const supabase = await createClient();

    await ensureShareRow(supabase, tenant.userId, tenant.companyId);
    const enabled = formData.get("enabled") === "true";
    const visibility = String(formData.get("visibility") ?? "BUSY");
    if (!["BUSY", "SUMMARY", "FULL"].includes(visibility)) {
      return { success: false, error: "Nivel de privacidad no válido." };
    }

    const { error } = await supabase
      .from("calendar_share_links")
      .update({ public_enabled: enabled, public_visibility: visibility })
      .eq("user_id", tenant.userId);
    if (error) return { success: false, error: "No se pudo actualizar la disponibilidad pública." };

    revalidatePath("/agenda");
    return { success: true, message: "Preferencias de disponibilidad actualizadas." };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error inesperado." };
  }
}

export async function regenerateShareTokens(): Promise<CalendarShareActionState> {
  try {
    await assertSameOrigin();
    await assertRateLimit("calendar-share-regenerate", 10);
    const tenant = await getTenantContext();
    const supabase = await createClient();

    await ensureShareRow(supabase, tenant.userId, tenant.companyId);
    const { error } = await supabase.rpc("regenerate_calendar_share_tokens");
    if (error) return { success: false, error: "No se pudieron regenerar los enlaces." };

    revalidatePath("/agenda");
    return { success: true, message: "Enlaces regenerados. Los anteriores dejaron de funcionar." };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error inesperado." };
  }
}
