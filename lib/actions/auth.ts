"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertRateLimit, assertSameOrigin, sanitizeText } from "@/lib/security";
import { trackAnalyticsEvent } from "@/lib/actions/notifications";

const emailSchema = z.string().email();

function humanizeSignUpError(rawMessage: string): string {
  const message = rawMessage.toLowerCase();

  if (message.includes("invalid") && message.includes("email")) {
    return "Ese correo no es válido para Supabase (por ejemplo, dominios de prueba como example.com son rechazados). Usa un correo real.";
  }
  if (message.includes("already registered") || message.includes("already exists")) {
    return "Ya existe una cuenta con ese correo. Inicia sesión o usa otro correo.";
  }
  if (message.includes("password")) {
    return "La contraseña no cumple los requisitos mínimos de seguridad.";
  }
  if (message.includes("rate limit") || message.includes("too many")) {
    return "Demasiados intentos. Espera unos minutos e intenta de nuevo.";
  }

  return "No se pudo crear la cuenta. Verifica los datos e intenta de nuevo.";
}

export type AuthActionState = {
  success: boolean;
  message?: string;
  error?: string;
};

export async function signIn(formData: FormData) {
  await assertSameOrigin();
  await assertRateLimit("sign-in", 10);
  const email = sanitizeText(formData.get("email"), 254).toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!emailSchema.safeParse(email).success || password.length < 6) {
    redirect("/login?error=Revisa%20tu%20correo%20y%20contrase%C3%B1a");
  }
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) redirect("/login?error=Credenciales%20inv%C3%A1lidas");

  await trackAnalyticsEvent("LOGIN");
  redirect("/");
}

export async function registerAccount(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  try {
    await assertSameOrigin();
    await assertRateLimit("sign-up", 5);

    const email = sanitizeText(formData.get("email"), 254).toLowerCase();
    const password = String(formData.get("password") ?? "");
    const fullName = sanitizeText(formData.get("full_name"), 120);
    const companyName = sanitizeText(formData.get("company_name"), 160);
    const industryTemplateId = sanitizeText(formData.get("industry_template_id"), 254);

    if (!emailSchema.safeParse(email).success) {
      return { success: false, error: "Ingresa un correo valido." };
    }

    if (password.length < 6) {
      return { success: false, error: "La contraseña debe tener al menos 6 caracteres." };
    }

    if (!fullName || !companyName) {
      return { success: false, error: "Completa tu nombre y el nombre de la empresa." };
    }

    if (!industryTemplateId) {
      return { success: false, error: "Selecciona una industria para continuar." };
    }

    const supabase = await createClient();
    const response = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          company_name: companyName,
          industry_template_id: industryTemplateId
        }
      }
    });

    if (response.error) {
      console.error("Supabase signUp failed", {
        message: response.error.message,
        status: response.error.status,
        name: response.error.name
      });

      return { success: false, error: humanizeSignUpError(response.error.message) };
    }

    // Si el proyecto de Supabase tiene desactivada la confirmación de correo,
    // signUp() ya devuelve una sesión activa aquí mismo - decirle al cliente
    // que "revise su correo" en ese caso es un paso fantasma que solo genera
    // confusión (se descubrió simulando el registro real de un cliente nuevo:
    // el login funcionó de inmediato sin confirmar nada).
    return response.data.session
      ? { success: true, message: "Cuenta creada. Ya puedes iniciar sesión." }
      : { success: true, message: "Cuenta creada. Revisa tu correo para confirmar el acceso." };
  } catch (error) {
    console.error("Register action failed", {
      message: error instanceof Error ? error.message : "Unknown error"
    });
    return { success: false, error: "No se pudo procesar el registro. Intenta nuevamente." };
  }
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
