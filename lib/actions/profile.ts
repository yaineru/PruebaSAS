"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant";
import { assertRateLimit, assertSameOrigin, sanitizeText } from "@/lib/security";

export type ProfileActionState = { success: boolean; message?: string; error?: string };

export async function updateProfileName(
  _previousState: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  try {
    await assertSameOrigin();
    await assertRateLimit("update-profile-name", 10);

    const fullName = sanitizeText(formData.get("full_name"), 120);
    if (!fullName) {
      return { success: false, error: "Ingresa tu nombre." };
    }

    const tenant = await getTenantContext();
    const supabase = await createClient();

    const { error } = await supabase.from("users").update({ full_name: fullName }).eq("id", tenant.userId);
    if (error) {
      console.error("Update profile name failed", { message: error.message });
      return { success: false, error: "No se pudo actualizar tu nombre." };
    }

    revalidatePath("/perfil");
    revalidatePath("/", "layout");
    return { success: true, message: "Nombre actualizado." };
  } catch (error) {
    console.error("updateProfileName failed", { message: error instanceof Error ? error.message : "unknown" });
    return { success: false, error: "No se pudo actualizar tu nombre." };
  }
}

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Ingresa tu contraseña actual."),
  newPassword: z.string().min(6, "La nueva contraseña debe tener al menos 6 caracteres.")
});

export async function changePassword(
  _previousState: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  try {
    await assertSameOrigin();
    await assertRateLimit("change-password", 5);

    const parsed = passwordSchema.safeParse({
      currentPassword: formData.get("current_password"),
      newPassword: formData.get("new_password")
    });

    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
    }

    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return { success: false, error: "Tu sesión expiró. Vuelve a iniciar sesión." };
    }

    // Require the current password before allowing a change - updateUser()
    // succeeds for any active session (e.g. a hijacked/stale tab) with no
    // extra check of its own, so this re-auth step is the only thing standing
    // between "someone left a tab open" and a silent full account takeover.
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: parsed.data.currentPassword
    });

    if (reauthError) {
      return { success: false, error: "La contraseña actual no es correcta." };
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: parsed.data.newPassword });
    if (updateError) {
      console.error("Password update failed", { message: updateError.message });
      return { success: false, error: "No se pudo actualizar la contraseña." };
    }

    return { success: true, message: "Contraseña actualizada correctamente." };
  } catch (error) {
    console.error("changePassword failed", { message: error instanceof Error ? error.message : "unknown" });
    return { success: false, error: "No se pudo actualizar la contraseña." };
  }
}
