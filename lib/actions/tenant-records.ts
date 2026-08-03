"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getModuleByKey, modules, type ModuleKey } from "@/lib/modules";
import { createClient } from "@/lib/supabase/server";
import type { TenantContext } from "@/lib/tenant";
import { assertCanCreate, assertCanDelete, assertRateLimit, assertSameOrigin, primitiveFieldSchema, sanitizeText } from "@/lib/security";
import { coerceEnumValue, enumSchemas } from "@/lib/enums";
import { trackAnalyticsEvent } from "@/lib/actions/notifications";

const allowedTables = modules.map((moduleDef) => moduleDef.table);
const createRecordSchema = z.object({
  table: z.custom<ModuleKey>((value) => allowedTables.includes(value as ModuleKey)),
  redirectTo: z.string().startsWith("/")
});
const updateRecordSchema = createRecordSchema.extend({
  recordId: z.string().uuid()
});
const uuidFieldSchema = z.string().uuid();

export type TenantRecordActionState = {
  success: boolean;
  message?: string;
  error?: string;
};

const defaultError = "No se pudo crear el registro. Verifica los datos e intenta de nuevo.";
const maxDocumentBytes = 20 * 1024 * 1024;
const allowedDocumentTypes = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation"
]);
const allowedDocumentExtensions = new Set(["pdf", "png", "jpg", "jpeg", "webp", "docx", "xlsx", "pptx"]);

const FK_TABLE_BY_FIELD: Record<string, string> = {
  asset_id: "assets",
  project_id: "projects",
  maintenance_record_id: "maintenance_records"
};

const UNIQUE_VIOLATION_CODE = "23505";
const uniqueConstraintMessages: Record<string, string> = {
  assets_company_id_code_key: "Ya existe un activo con ese código en tu empresa.",
  projects_company_id_code_key: "Ya existe una obra con ese código en tu empresa."
};

function failure(error: string): TenantRecordActionState {
  return { success: false, error };
}

async function resolveTenantContextForAction(): Promise<TenantContext> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.warn("Tenant record auth lookup failed", {
      message: userError?.message
    });
    throw new Error("Tu sesión expiró. Inicia sesión nuevamente.");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("user_id, company_id, role, companies!company_id(name)")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .single();

  if (!membershipError && membership) {
    const company = Array.isArray(membership.companies) ? membership.companies[0] : membership.companies;

    return {
      userId: membership.user_id,
      authUserId: user.id,
      companyId: membership.company_id,
      companyName: company?.name ?? "Empresa",
      role: membership.role
    };
  }

  console.warn("Tenant record membership lookup failed; falling back to users profile", {
    authUserId: user.id,
    message: membershipError?.message,
    code: membershipError?.code
  });

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("id, company_id, role, companies!company_id(name)")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .single();

  if (profileError || !profile) {
    console.warn("Tenant record profile lookup failed", {
      authUserId: user.id,
      message: profileError?.message,
      code: profileError?.code
    });
    throw new Error("Tu usuario no tiene una empresa activa. Revisa el onboarding.");
  }

  const company = Array.isArray(profile.companies) ? profile.companies[0] : profile.companies;

  return {
    userId: profile.id,
    authUserId: user.id,
    companyId: profile.company_id,
    companyName: company?.name ?? "Empresa",
    role: profile.role
  };
}

async function buildFieldsPayload(
  moduleDef: NonNullable<ReturnType<typeof getModuleByKey>>,
  table: ModuleKey,
  formData: FormData,
  tenant: TenantContext,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<Record<string, string | number>> {
  const payloadEntries: Array<[string, string | number]> = [];

  for (const field of moduleDef.fields) {
    const rawValue = formData.get(field.name);
    const trimmedValue = String(rawValue ?? "").trim();

    if (field.required && trimmedValue === "") {
      throw new Error(`Completa el campo ${field.label}.`);
    }

    if (!field.required && trimmedValue === "") {
      continue;
    }

    if (field.enumKey) {
      const enumValue = coerceEnumValue(field.enumKey, rawValue);
      if (enumValue) {
        enumSchemas[field.enumKey].parse(enumValue);
        payloadEntries.push([field.name, enumValue]);
      }
      continue;
    }

    if (field.options) {
      const optionValue = trimmedValue;
      const validValues = field.options.map((option) => option.value);
      if (!validValues.includes(optionValue)) {
        throw new Error(`Selecciona un valor válido para ${field.label}.`);
      }
      payloadEntries.push([field.name, optionValue]);
      continue;
    }

    if (field.type === "uuid") {
      const uuidValue = uuidFieldSchema.parse(trimmedValue);

      const relatedTable = FK_TABLE_BY_FIELD[field.name];
      if (relatedTable) {
        const { data: relatedRecord, error: relatedError } = await supabase
          .from(relatedTable)
          .select("id")
          .eq("id", uuidValue)
          .eq("company_id", tenant.companyId)
          .maybeSingle();

        if (relatedError || !relatedRecord) {
          throw new Error(`${field.label} no pertenece a tu empresa o no existe.`);
        }
      }

      payloadEntries.push([field.name, uuidValue]);
      continue;
    }

    if (field.type === "date") {
      const parsedDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(trimmedValue);
      if (table === "asset_documents" && field.name === "expires_at") {
        const todayIso = new Date().toISOString().slice(0, 10);
        if (parsedDate < todayIso) {
          throw new Error("La fecha de vencimiento no puede estar en el pasado.");
        }
      }
      payloadEntries.push([field.name, parsedDate]);
      continue;
    }

    const cleanValue = primitiveFieldSchema.parse(
      field.type === "number" && rawValue ? Number(rawValue) : sanitizeText(rawValue)
    );
    const normalizedValue = cleanValue === null ? "" : cleanValue;
    payloadEntries.push([field.name, normalizedValue]);
  }

  return Object.fromEntries(payloadEntries) as Record<string, string | number>;
}

export async function createTenantRecord(
  _previousState: TenantRecordActionState,
  formData: FormData
): Promise<TenantRecordActionState> {
  let parsed: z.infer<typeof createRecordSchema> | null = null;

  try {
    await assertSameOrigin();
    await assertRateLimit("tenant-record-create", 30);

    const parsedResult = createRecordSchema.safeParse({
      table: formData.get("table"),
      redirectTo: formData.get("redirectTo")
    });

    if (!parsedResult.success) {
      console.warn("Tenant record request schema failed", parsedResult.error.flatten());
      return failure("La solicitud no es válida. Recarga la página e intenta de nuevo.");
    }

    parsed = parsedResult.data;
    const table = parsed.table;
    const moduleDef = getModuleByKey(parsed.table);

    if (!moduleDef) {
      console.warn("Tenant record unsupported module", { table: parsed.table });
      return failure("Módulo no soportado.");
    }

    const tenant = await resolveTenantContextForAction();
    assertCanCreate(parsed.table, tenant);

    const supabase = await createClient();
    const payload = await buildFieldsPayload(moduleDef, table, formData, tenant, supabase);

    if (parsed.table === "users" && payload.role === "SUPER_ADMIN" && tenant.role !== "SUPER_ADMIN") {
      return failure("Solo un Super Administrador puede asignar ese rol.");
    }

    if (parsed.table === "asset_documents") {
      const fileName = sanitizeText(formData.get("file_name"), 255);
      const filePath = sanitizeText(formData.get("file_path"), 1000);
      const mimeType = sanitizeText(formData.get("mime_type"), 255);
      const fileSize = Number(formData.get("file_size"));
      const extension = fileName.split(".").pop()?.toLowerCase() ?? "";

      if (!fileName || !filePath || !mimeType || !Number.isFinite(fileSize)) {
        return failure("Selecciona y carga un archivo antes de guardar el documento.");
      }

      if (!filePath.startsWith(`${tenant.companyId}/documents/`)) {
        return failure("La ruta del archivo no pertenece a tu empresa.");
      }

      if (!allowedDocumentTypes.has(mimeType) || !allowedDocumentExtensions.has(extension)) {
        return failure("El tipo de archivo no está permitido.");
      }

      if (fileSize <= 0 || fileSize > maxDocumentBytes) {
        return failure("El archivo supera el tamaño máximo de 20 MB.");
      }

      payload.file_name = fileName;
      payload.file_path = filePath;
      payload.mime_type = mimeType;
      payload.file_size = fileSize;
      payload.uploaded_by = tenant.userId;
      payload.uploaded_at = new Date().toISOString();
    }

    const { error } = await supabase.from(parsed.table).insert({
      ...payload,
      company_id: tenant.companyId,
      created_by: tenant.userId
    });

    if (error) {
      console.error("Tenant record insert failed", {
        table: parsed.table,
        code: error.code,
        message: error.message,
        details: error.details
      });

      if (error.code === UNIQUE_VIOLATION_CODE) {
        const constraintName = Object.keys(uniqueConstraintMessages).find((key) => error.message.includes(key));
        return failure(
          constraintName ? uniqueConstraintMessages[constraintName] : "Ya existe un registro con esos mismos datos únicos."
        );
      }

      return failure(defaultError);
    }

    await trackAnalyticsEvent(`CREATE_${parsed.table.toUpperCase()}`);
    revalidatePath(parsed.redirectTo);
    return { success: true, message: "Registro creado correctamente." };
  } catch (error) {
    console.error("Tenant record action failed", {
      table: parsed?.table,
      message: error instanceof Error ? error.message : "Unknown error"
    });
    return failure(error instanceof Error ? error.message : defaultError);
  }
}

export async function updateTenantRecord(
  _previousState: TenantRecordActionState,
  formData: FormData
): Promise<TenantRecordActionState> {
  let parsed: z.infer<typeof updateRecordSchema> | null = null;

  try {
    await assertSameOrigin();
    await assertRateLimit("tenant-record-update", 30);

    const parsedResult = updateRecordSchema.safeParse({
      table: formData.get("table"),
      redirectTo: formData.get("redirectTo"),
      recordId: formData.get("recordId")
    });

    if (!parsedResult.success) {
      console.warn("Tenant record update request schema failed", parsedResult.error.flatten());
      return failure("La solicitud no es válida. Recarga la página e intenta de nuevo.");
    }

    parsed = parsedResult.data;
    const table = parsed.table;
    const moduleDef = getModuleByKey(parsed.table);

    if (!moduleDef) {
      console.warn("Tenant record unsupported module", { table: parsed.table });
      return failure("Módulo no soportado.");
    }

    const tenant = await resolveTenantContextForAction();
    // Editing a record requires the same permission tier as creating one.
    assertCanCreate(parsed.table, tenant);

    const supabase = await createClient();
    const payload = await buildFieldsPayload(moduleDef, table, formData, tenant, supabase);

    if (parsed.table === "users" && payload.role === "SUPER_ADMIN" && tenant.role !== "SUPER_ADMIN") {
      return failure("Solo un Super Administrador puede asignar ese rol.");
    }

    const { data: updated, error } = await supabase
      .from(parsed.table)
      .update({
        ...payload,
        updated_by: tenant.userId
      })
      .eq("id", parsed.recordId)
      .eq("company_id", tenant.companyId)
      .select("id");

    if (error) {
      console.error("Tenant record update failed", {
        table: parsed.table,
        code: error.code,
        message: error.message,
        details: error.details
      });

      if (error.code === UNIQUE_VIOLATION_CODE) {
        const constraintName = Object.keys(uniqueConstraintMessages).find((key) => error.message.includes(key));
        return failure(
          constraintName ? uniqueConstraintMessages[constraintName] : "Ya existe un registro con esos mismos datos únicos."
        );
      }

      return failure(defaultError.replace("crear", "actualizar"));
    }

    if (!updated || updated.length === 0) {
      return failure("El registro no existe o no pertenece a tu empresa.");
    }

    await trackAnalyticsEvent(`UPDATE_${parsed.table.toUpperCase()}`);
    revalidatePath(parsed.redirectTo);
    return { success: true, message: "Registro actualizado correctamente." };
  } catch (error) {
    console.error("Tenant record update action failed", {
      table: parsed?.table,
      message: error instanceof Error ? error.message : "Unknown error"
    });
    return failure(error instanceof Error ? error.message : defaultError.replace("crear", "actualizar"));
  }
}

export async function deleteTenantRecord(table: ModuleKey, recordId: string) {
  try {
    await assertSameOrigin();
    await assertRateLimit("tenant-record-delete", 30);

    if (!allowedTables.includes(table)) {
      return failure("Tabla no soportada.");
    }
    uuidFieldSchema.parse(recordId);

    const tenant = await resolveTenantContextForAction();
    assertCanDelete(table, tenant);

    const supabase = await createClient();
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("id", recordId)
      .eq("company_id", tenant.companyId);

    if (error) {
      console.error("Tenant record delete failed", {
        table,
        code: error.code,
        message: error.message
      });
      return failure("No se pudo eliminar el registro.");
    }

    const moduleDef = getModuleByKey(table);
    if (moduleDef) revalidatePath(moduleDef.href);

    return { success: true, message: "Registro eliminado correctamente." };
  } catch (error) {
    console.error("Tenant record delete action failed", {
      table,
      message: error instanceof Error ? error.message : "Unknown error"
    });
    return failure(error instanceof Error ? error.message : defaultError);
  }
}

