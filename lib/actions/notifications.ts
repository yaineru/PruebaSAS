'use server';

import { createClient } from "@/lib/supabase/server";
import { assertRateLimit, assertSameOrigin, sanitizeText } from "@/lib/security";
import { revalidatePath } from "next/cache";

// ============ EMAIL SUBSCRIPTIONS ============

export async function updateEmailSubscription(
  _previousState: { success: boolean; message?: string; error?: string },
  formData: FormData
) {
  try {
    await assertSameOrigin();
    await assertRateLimit("email-subscription-update", 30);

    const supabase = await createClient();
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: "Tu sesión expiró. Inicia sesión nuevamente." };
    }

    // Get user profile to find userId
    const { data: profile } = await supabase
      .from("users")
      .select("id, company_id")
      .eq("auth_user_id", user.id)
      .single();

    if (!profile) {
      return { success: false, error: "Usuario no encontrado." };
    }

    const eventType = sanitizeText(formData.get("event_type"), 100);
    const enabled = formData.get("enabled") === "true";
    const frequency = (sanitizeText(formData.get("frequency"), 50) || "IMMEDIATE") as "IMMEDIATE" | "DAILY_DIGEST" | "WEEKLY_DIGEST";

    // Upsert subscription
    const { error } = await supabase.from("email_subscriptions").upsert(
      {
        company_id: profile.company_id,
        user_id: profile.id,
        event_type: eventType,
        enabled,
        frequency
      },
      { onConflict: "company_id,user_id,event_type,frequency" }
    );

    if (error) {
      console.error("Email subscription update failed", { error: error.message });
      return { success: false, error: "No se pudo actualizar la suscripción." };
    }

    revalidatePath("/settings/notifications");
    return { success: true, message: "Preferencia actualizada correctamente." };
  } catch (error) {
    console.error("Email subscription action failed", {
      message: error instanceof Error ? error.message : "Unknown error"
    });
    return { success: false, error: "Error al procesar tu solicitud." };
  }
}

// ============ WEBHOOKS ============

export async function createWebhook(
  _previousState: { success: boolean; message?: string; error?: string; webhookId?: string },
  formData: FormData
) {
  try {
    await assertSameOrigin();
    await assertRateLimit("webhook-create", 10);

    const supabase = await createClient();
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: "Tu sesión expiró." };
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("users")
      .select("id, company_id, role")
      .eq("auth_user_id", user.id)
      .single();

    if (!profile || profile.role !== "ADMIN") {
      return { success: false, error: "No tienes permiso para crear webhooks." };
    }

    // Validate input
    const name = sanitizeText(formData.get("name"), 100);
    const description = sanitizeText(formData.get("description"), 500);
    const url = sanitizeText(formData.get("url"), 1000);
    // The event checkboxes all share name="events" (one <input> per event, see
    // components/webhook-management.tsx) - formData.get() only returns the
    // first checked value, silently dropping the rest. getAll() is required
    // to collect every checked checkbox.
    const events = formData.getAll("events").map((value) => String(value));

    if (!name || !url) {
      return { success: false, error: "Completa el nombre y URL del webhook." };
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return { success: false, error: "La URL debe ser válida." };
    }

    if (events.length === 0) {
      return { success: false, error: "Selecciona al menos un evento." };
    }

    // Generate secret
    const secret = crypto.randomUUID();

    // Create webhook
    const { data: webhook, error } = await supabase
      .from("webhooks")
      .insert({
        company_id: profile.company_id,
        created_by: profile.id,
        name,
        description: description || null,
        url,
        secret,
        events,
        active: true
      })
      .select("id")
      .single();

    if (error) {
      console.error("Webhook creation failed", { error: error.message });
      return { success: false, error: "No se pudo crear el webhook." };
    }

    revalidatePath("/settings/webhooks");
    return {
      success: true,
      message: "Webhook creado correctamente.",
      webhookId: webhook.id
    };
  } catch (error) {
    console.error("Webhook create action failed", {
      message: error instanceof Error ? error.message : "Unknown error"
    });
    return { success: false, error: "Error al procesar tu solicitud." };
  }
}

export async function deleteWebhook(
  _previousState: { success: boolean; message?: string; error?: string },
  formData: FormData
) {
  try {
    await assertSameOrigin();
    await assertRateLimit("webhook-delete", 20);

    const webhookId = sanitizeText(formData.get("webhook_id"), 100);

    if (!webhookId) {
      return { success: false, error: "ID de webhook no válido." };
    }

    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Tu sesión expiró." };
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("users")
      .select("id, company_id, role")
      .eq("auth_user_id", user.id)
      .single();

    if (!profile || profile.role !== "ADMIN") {
      return { success: false, error: "No tienes permiso." };
    }

    // Soft delete webhook
    const { error } = await supabase
      .from("webhooks")
      .update({ active: false })
      .eq("id", webhookId)
      .eq("company_id", profile.company_id);

    if (error) {
      console.error("Webhook deletion failed", { error: error.message });
      return { success: false, error: "No se pudo eliminar el webhook." };
    }

    revalidatePath("/settings/webhooks");
    return { success: true, message: "Webhook eliminado correctamente." };
  } catch (error) {
    console.error("Webhook delete action failed", {
      message: error instanceof Error ? error.message : "Unknown error"
    });
    return { success: false, error: "Error al procesar tu solicitud." };
  }
}

// ============ ANALYTICS ============

export async function trackAnalyticsEvent(eventName: string, properties?: Record<string, unknown>) {
  try {
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data: profile } = await supabase
      .from("users")
      .select("id, company_id")
      .eq("auth_user_id", user.id)
      .single();

    if (!profile) return;

    await supabase.from("analytics_events").insert({
      company_id: profile.company_id,
      user_id: profile.id,
      event_name: eventName,
      properties: properties || null,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.warn("Analytics tracking failed", {
      message: error instanceof Error ? error.message : "Unknown"
    });
  }
}
