"use client";

import { getOfflineDb, LEGACY_CRUD_TABLE, type QueueFile, type QueueOperation } from "@/lib/offline/db";
import { createTenantRecord, deleteTenantRecord, updateTenantRecord } from "@/lib/actions/tenant-records";
import { generateTechnicalReport } from "@/lib/actions/technical-reports";
import { generateReport, sendReportByEmail } from "@/lib/actions/reports";
import { createClient } from "@/lib/supabase/browser";
import type { ModuleKey } from "@/lib/modules";

function crudPayloadToFormData(operation: QueueOperation, table: string, action: "CREATE" | "UPDATE"): FormData {
  const formData = new FormData();
  formData.set("table", table);
  formData.set("redirectTo", String(operation.payload.__redirectTo ?? "/"));
  formData.set("client_op_id", operation.id);
  if (action === "UPDATE" && operation.recordId) {
    formData.set("recordId", operation.recordId);
  }
  if (action === "CREATE" && operation.recordId) {
    formData.set("id", operation.recordId);
  }
  for (const [key, value] of Object.entries(operation.payload)) {
    if (key.startsWith("__")) continue;
    if (value === null || value === undefined) continue;
    formData.set(key, String(value));
  }
  return formData;
}

type SyncResult = { success: boolean; error?: string };

async function syncCrudOperation(operation: QueueOperation, table: string, action: "CREATE" | "UPDATE" | "DELETE"): Promise<SyncResult> {
  if (action === "DELETE") {
    if (!operation.recordId) return { success: false, error: "Falta el identificador del registro a eliminar." };
    try {
      const result = await deleteTenantRecord(table as ModuleKey, operation.recordId);
      if (result.success) return { success: true };
      return { success: false, error: result.error || "No se pudo eliminar el registro." };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Error de red al eliminar." };
    }
  }

  const formData = crudPayloadToFormData(operation, table, action);
  try {
    const result = await (action === "UPDATE" ? updateTenantRecord : createTenantRecord)({ success: false }, formData);
    if (result.success) return { success: true };
    return { success: false, error: result.error || "No se pudo sincronizar." };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error de red al sincronizar." };
  }
}

// El archivo del documento se guardó como Blob en Dexie mientras no había
// conexión (ver tenant-record-form.tsx) - nunca se sube mientras el
// dispositivo está offline. Al sincronizar se reproduce exactamente el mismo
// flujo de dos pasos que ya usa el formulario online (subir a Storage,
// después insertar la fila de metadata) para no duplicar lógica de
// validación de tipo/tamaño en dos lugares distintos.
async function syncDocumentOperation(scopeKey: string, operation: QueueOperation): Promise<SyncResult> {
  const db = getOfflineDb(scopeKey);
  const file = await db.files.where("operationId").equals(operation.id).first();
  if (!file) {
    return { success: false, error: "El archivo del documento ya no está disponible en este dispositivo." };
  }

  const companyId = String(operation.payload.__companyId ?? "");
  if (!companyId) return { success: false, error: "Falta la empresa del documento." };

  try {
    const supabase = createClient();
    const safeName = file.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${companyId}/documents/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from("company-files")
      .upload(path, file.blob, { contentType: file.mimeType, upsert: false });

    if (uploadError) {
      return { success: false, error: "No se pudo subir el archivo. Se reintentará cuando vuelva la conexión." };
    }

    const formData = new FormData();
    formData.set("table", "asset_documents");
    formData.set("redirectTo", String(operation.payload.__redirectTo ?? "/documentos"));
    formData.set("client_op_id", operation.id);
    formData.set("file_name", file.fileName);
    formData.set("file_path", path);
    formData.set("mime_type", file.mimeType);
    formData.set("file_size", String(file.blob.size));
    for (const [key, value] of Object.entries(operation.payload)) {
      if (key.startsWith("__")) continue;
      if (value === null || value === undefined) continue;
      formData.set(key, String(value));
    }

    const result = await createTenantRecord({ success: false }, formData);
    if (result.success) return { success: true };
    return { success: false, error: result.error || "No se pudo guardar el documento." };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error de red al subir el documento." };
  }
}

// Las fotos de evidencia se guardaron como Blob ya comprimido (ver
// components/technical-report-form.tsx) - se suben una por una al bucket
// "reports" con el mismo esquema de ruta y firma de URL que usa el flujo
// online (EvidencePicker), y el resultado reemplaza el campo
// `evidenceUrl_<n>` correspondiente antes de llamar a la Server Action real.
// Las firmas viajan como texto (base64) dentro del payload desde que se
// capturaron - nunca fueron un Blob, así que no necesitan subida aparte.
async function syncTechnicalReportOperation(scopeKey: string, operation: QueueOperation): Promise<SyncResult> {
  const db = getOfflineDb(scopeKey);
  const files = await db.files.where("operationId").equals(operation.id).toArray();
  const companyId = String(operation.payload.__companyId ?? "");
  if (!companyId) return { success: false, error: "Falta la empresa del informe técnico." };

  try {
    const supabase = createClient();
    const formData = new FormData();
    for (const [key, value] of Object.entries(operation.payload)) {
      if (key.startsWith("__")) continue;
      if (value === null || value === undefined) continue;
      formData.set(key, String(value));
    }
    formData.set("client_op_id", operation.id);

    for (const file of files) {
      const uploaded = await uploadEvidenceFile(supabase, companyId, file);
      if (!uploaded.success) return uploaded;
      formData.set(file.fieldName, uploaded.url);
    }

    const result = await generateTechnicalReport(formData);
    if (result.success) return { success: true };
    return { success: false, error: result.error || "No se pudo generar el informe técnico." };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error de red al sincronizar el informe técnico." };
  }
}

async function uploadEvidenceFile(
  supabase: ReturnType<typeof createClient>,
  companyId: string,
  file: QueueFile
): Promise<{ success: true; url: string } | { success: false; error: string }> {
  const ext = file.mimeType === "image/png" ? "png" : file.mimeType === "image/webp" ? "webp" : "jpg";
  const path = `${companyId}/technical/evidence/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from("reports").upload(path, file.blob, { contentType: file.mimeType });
  if (uploadError) {
    return { success: false, error: "No se pudo subir una foto de evidencia. Se reintentará cuando vuelva la conexión." };
  }

  const { data: signed, error: signError } = await supabase.storage.from("reports").createSignedUrl(path, 60 * 60 * 24 * 365);
  if (signError || !signed?.signedUrl) {
    return { success: false, error: "No se pudo generar el enlace de una foto. Se reintentará." };
  }

  return { success: true, url: signed.signedUrl };
}

async function syncGenerateReportOperation(operation: QueueOperation): Promise<SyncResult> {
  try {
    const formData = new FormData();
    for (const [key, value] of Object.entries(operation.payload)) {
      if (key.startsWith("__")) continue;
      if (value === null || value === undefined) continue;
      formData.set(key, String(value));
    }
    formData.set("client_op_id", operation.id);

    const result = await generateReport(formData);
    if (result.success) return { success: true };
    return { success: false, error: result.error || "No se pudo generar el informe." };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error de red al generar el informe." };
  }
}

async function syncSendReportEmailOperation(operation: QueueOperation): Promise<SyncResult> {
  try {
    const reportId = String(operation.payload.reportId || "");
    if (!reportId) return { success: false, error: "Falta el informe a enviar." };
    const formData = new FormData();
    formData.set("to", String(operation.payload.to || ""));
    formData.set("cc", String(operation.payload.cc || ""));
    formData.set("subject", String(operation.payload.subject || ""));
    formData.set("message", String(operation.payload.message || ""));

    const result = await sendReportByEmail(reportId, formData);
    if (result.success) return { success: true };
    return { success: false, error: result.error || "No se pudo enviar el correo." };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error de red al enviar el correo." };
  }
}

async function syncOneOperation(scopeKey: string, operation: QueueOperation): Promise<SyncResult> {
  if (operation.type === "CREATE_DOCUMENT") {
    return syncDocumentOperation(scopeKey, operation);
  }
  if (operation.type === "CREATE_TECHNICAL_REPORT") {
    return syncTechnicalReportOperation(scopeKey, operation);
  }
  if (operation.type === "GENERATE_REPORT") {
    return syncGenerateReportOperation(operation);
  }
  if (operation.type === "SEND_REPORT_EMAIL") {
    return syncSendReportEmailOperation(operation);
  }
  if (operation.type === "CRUD" && operation.table && operation.action) {
    return syncCrudOperation(operation, operation.table, operation.action);
  }
  const legacyTable = LEGACY_CRUD_TABLE[operation.type];
  if (legacyTable) {
    return syncCrudOperation(operation, legacyTable, "CREATE");
  }
  return { success: false, error: `Tipo de operación no reconocido: ${operation.type}.` };
}

export type SyncSummary = {
  synced: number;
  failed: number;
};

// Antes de sincronizar, cualquier operación que haya quedado en SYNCING de
// una sesión anterior (la pestaña se cerró o el proceso murió a mitad de un
// envío) se trata como interrumpida, no como "en curso ahora mismo" - una
// sesión nueva nunca puede tener algo genuinamente en vuelo todavía. Se
// reintenta sin riesgo de duplicar gracias al client_op_id idempotente.
async function reclaimStuckOperations(scopeKey: string): Promise<void> {
  const db = getOfflineDb(scopeKey);
  await db.operations.where("status").equals("SYNCING").modify({ status: "PENDING" });
}

// Evita procesar la misma cola dos veces en paralelo dentro de esta misma
// pestaña (ej. dos componentes disparando la sincronización casi al mismo
// tiempo, o un remount de React en desarrollo) - sin esto, dos pasadas
// concurrentes pueden pisarse las actualizaciones de estado en Dexie y dejar
// una operación colgada en SYNCING para siempre aunque el envío ya haya
// terminado.
const inFlightSyncs = new Map<string, Promise<SyncSummary>>();

export function processQueue(scopeKey: string, onProgress?: (op: QueueOperation) => void): Promise<SyncSummary> {
  const existing = inFlightSyncs.get(scopeKey);
  if (existing) return existing;

  const promise = runQueue(scopeKey, onProgress).finally(() => {
    inFlightSyncs.delete(scopeKey);
  });
  inFlightSyncs.set(scopeKey, promise);
  return promise;
}

// Procesa la cola en orden de creación (FIFO), una operación a la vez -
// deliberadamente secuencial, no en paralelo. Esto no es solo para no saturar
// una conexión débil recién recuperada: como cada entidad creada offline usa
// un id elegido en el propio dispositivo (ver CLIENT_ID_TABLES en
// lib/actions/tenant-records.ts), una fila que depende de otra (ej. un
// Mantenimiento que referencia una Obra creada offline momentos antes) solo
// puede insertarse después de que su "padre" ya exista en Supabase - el
// orden FIFO natural (se crean en el mismo orden en que el usuario las llenó
// en el formulario) ya resuelve la dependencia sin necesidad de un mapeo
// local-id -> server-id aparte. Si el padre falla en este intento, el hijo
// también fallará (violación de llave foránea) y ambos se reintentan juntos
// en el siguiente ciclo, en el mismo orden.
async function runQueue(scopeKey: string, onProgress?: (op: QueueOperation) => void): Promise<SyncSummary> {
  await reclaimStuckOperations(scopeKey);
  const db = getOfflineDb(scopeKey);
  const pending = await db.operations
    .where("status")
    .anyOf(["PENDING", "FAILED"])
    .sortBy("createdAt");

  let synced = 0;
  let failed = 0;

  for (const operation of pending) {
    await db.operations.update(operation.id, { status: "SYNCING", updatedAt: Date.now() });
    onProgress?.({ ...operation, status: "SYNCING" });

    const result = await syncOneOperation(scopeKey, operation);

    if (result.success) {
      await db.operations.update(operation.id, { status: "SYNCED", updatedAt: Date.now(), lastError: undefined });
      await db.files.where("operationId").equals(operation.id).delete();
      synced += 1;
    } else {
      await db.operations.update(operation.id, {
        status: "FAILED",
        updatedAt: Date.now(),
        attempts: operation.attempts + 1,
        lastError: result.error
      });
      failed += 1;
    }
  }

  return { synced, failed };
}

// Descarta una operación que quedó definitivamente en FAILED (ej. el
// registro al que apuntaba ya no existe) - sin esto, algo así queda
// "pendiente" para siempre en la lista sin que el usuario tenga forma de
// limpiarlo. No aplica a PENDING/SYNCING (esas sí deben sincronizarse) ni
// borra archivos de una operación que todavía podría reintentarse con éxito.
export async function discardOperation(scopeKey: string, operationId: string): Promise<void> {
  const db = getOfflineDb(scopeKey);
  await db.operations.delete(operationId);
  await db.files.where("operationId").equals(operationId).delete();
}
