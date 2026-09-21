"use client";

import { getOfflineDb, type QueueOperation, type QueueOperationType } from "@/lib/offline/db";
import { createTenantRecord } from "@/lib/actions/tenant-records";
import { createClient } from "@/lib/supabase/browser";

// Tabla real que corresponde a cada tipo de operación en cola - mismo nombre
// que usa el motor genérico de módulos (lib/modules.ts / lib/actions/tenant-records.ts).
const TABLE_BY_TYPE: Record<Exclude<QueueOperationType, "CREATE_TECHNICAL_REPORT">, string> = {
  CREATE_MAINTENANCE: "maintenance_records",
  CREATE_INCIDENT: "incidents",
  CREATE_ASSET: "assets"
};

function payloadToFormData(operation: QueueOperation, table: string): FormData {
  const formData = new FormData();
  formData.set("table", table);
  formData.set("redirectTo", String(operation.payload.__redirectTo ?? "/"));
  formData.set("client_op_id", operation.id);
  for (const [key, value] of Object.entries(operation.payload)) {
    if (key === "__redirectTo") continue;
    if (value === null || value === undefined) continue;
    formData.set(key, String(value));
  }
  return formData;
}

async function syncOneOperation(operation: QueueOperation): Promise<{ success: boolean; error?: string }> {
  if (operation.type === "CREATE_TECHNICAL_REPORT") {
    // Fase 2: los informes técnicos offline se documentan como limitación
    // actual (ver manual) - no hay un handler de sincronización todavía.
    return { success: false, error: "Sincronización de informes técnicos offline no disponible todavía." };
  }

  const table = TABLE_BY_TYPE[operation.type];
  const formData = payloadToFormData(operation, table);

  try {
    const result = await createTenantRecord({ success: false }, formData);
    if (result.success) return { success: true };
    return { success: false, error: result.error || "No se pudo sincronizar." };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error de red al sincronizar." };
  }
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
// deliberadamente secuencial, no en paralelo: mantenimientos/novedades
// creados en cierto orden en campo deben llegar a Supabase en ese mismo
// orden, y evita saturar la conexión (a menudo débil, justo saliendo de una
// zona sin señal) con ráfagas de requests simultáneos.
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

    const result = await syncOneOperation(operation);

    if (result.success) {
      await db.operations.update(operation.id, { status: "SYNCED", updatedAt: Date.now(), lastError: undefined });
      // Los archivos adjuntos (fotos/firmas) ya viajaron dentro del payload
      // como texto/URL para los tipos soportados hoy - no hay blobs propios
      // que limpiar en esta fase, pero se libera el espacio igual por si acaso.
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

// Sube un archivo (foto/documento) directamente a Storage, igual que el
// resto de la app hace cuando hay conexión - se usa solo al sincronizar
// (nunca mientras el dispositivo está offline).
export async function uploadQueuedFile(companyId: string, folder: string, blob: Blob, fileName: string): Promise<string> {
  const supabase = createClient();
  const ext = fileName.split(".").pop() || "bin";
  const path = `${companyId}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("company-files").upload(path, blob, { contentType: blob.type });
  if (error) throw error;
  return path;
}
