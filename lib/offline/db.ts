"use client";

import Dexie, { type Table } from "dexie";

// Modo offline de campo - cola universal de sincronización.
//
// Aislamiento multi-tenant/multi-usuario: cada combinación (usuario, empresa)
// obtiene su PROPIA base de datos IndexedDB, nombrada
// `eos_offline_<authUserId>_<companyId>`. Esto no es una convención que haya
// que recordar respetar en cada query - es una propiedad estructural: dos
// scopes distintos son, literalmente, dos bases de datos del navegador
// distintas, así que no existe una consulta posible que mezcle datos de la
// Empresa A con los de la Empresa B, ni que un usuario nuevo en el mismo
// dispositivo vea o sincronice sin querer la cola pendiente del usuario
// anterior. Si el usuario original vuelve a iniciar sesión en ese mismo
// dispositivo, su cola sigue esperándolo intacta - cerrar sesión no la borra.

// Tipos de operación:
// - "CRUD": create/update/delete genérico contra una tabla del motor
//   `lib/actions/tenant-records.ts` (assets, projects, maintenance_records,
//   incidents). `action` + `table` dicen qué hacer; `recordId` identifica la
//   fila en UPDATE/DELETE.
// - Los strings legacy CREATE_MAINTENANCE/CREATE_INCIDENT/CREATE_ASSET siguen
//   soportados en lib/offline/sync.ts por compatibilidad con colas ya
//   guardadas en el dispositivo de un usuario antes de esta versión - nunca
//   se generan nuevas con esa forma, pero una ya encolada no debe perderse
//   ni fallar solo por el cambio de esquema.
// - Tipos de "acción externa": no son un create/update/delete de una tabla
//   tenant, son una operación que solo puede completarse al recuperar
//   conexión real (enviar un correo, generar un PDF en servidor, crear un
//   evento en Google Calendar, invitar un usuario). Se guardan igual en la
//   cola y se resuelven en lib/offline/sync.ts.
export type CrudAction = "CREATE" | "UPDATE" | "DELETE";

export type QueueOperationType =
  | "CRUD"
  | "CREATE_MAINTENANCE"
  | "CREATE_INCIDENT"
  | "CREATE_ASSET"
  | "CREATE_TECHNICAL_REPORT"
  | "CREATE_DOCUMENT"
  | "SEND_REPORT_EMAIL"
  | "GENERATE_REPORT"
  | "CALENDAR_CREATE_EVENT"
  | "INVITE_USER";

// "DRAFT" es exclusivo de formularios largos que se llenan por partes (hoy,
// solo Informes técnicos): existe mientras el usuario todavía está
// completando el formulario, para que sobreviva un cierre/recarga aunque
// nunca haya tocado "Generar informe" - `runQueue` nunca la toca (solo
// procesa PENDING/FAILED), pasa a PENDING recién cuando el usuario confirma
// que terminó.
export type QueueStatus = "DRAFT" | "PENDING" | "SYNCING" | "SYNCED" | "FAILED";

export type QueueOperation = {
  id: string; // uuid generado en el dispositivo - también sirve como client_op_id (idempotency key) del lado del servidor
  type: QueueOperationType;
  // Solo para type "CRUD":
  table?: string;
  action?: CrudAction;
  recordId?: string; // fila objetivo en UPDATE/DELETE (real o generada en el dispositivo, ver localRecordId en payload de CREATE)
  payload: Record<string, unknown>;
  status: QueueStatus;
  createdAt: number;
  updatedAt: number;
  attempts: number;
  lastError?: string;
  // Etiqueta legible para la UI (ej. el título del mantenimiento) - evita
  // tener que decodificar el payload solo para mostrar la lista de pendientes.
  summary: string;
};

// Tabla real de cada tipo de operación legacy - ver comentario sobre
// QueueOperationType más arriba. Vive acá (no en sync.ts) porque tanto el
// motor de sincronización como la UI de "pendientes" necesitan saber a qué
// tabla/módulo corresponde una operación vieja.
export const LEGACY_CRUD_TABLE: Partial<Record<QueueOperationType, string>> = {
  CREATE_MAINTENANCE: "maintenance_records",
  CREATE_INCIDENT: "incidents",
  CREATE_ASSET: "assets"
};

export type QueueFile = {
  id: string; // uuid
  operationId: string;
  fieldName: string; // ej. "evidence_0", "technicalSignatureImage", "document_file"
  blob: Blob;
  mimeType: string;
  fileName: string;
  // Metadata extra por tipo de archivo - ej. { evidenceType: "before" } para
  // fotos de informes técnicos, para no perder la clasificación Antes/
  // Después/Evidencia entre que se guarda localmente y se sube al sincronizar.
  meta?: Record<string, string>;
  createdAt: number;
};

export class OfflineDB extends Dexie {
  operations!: Table<QueueOperation, string>;
  files!: Table<QueueFile, string>;

  constructor(scopeKey: string) {
    super(`eos_offline_${scopeKey}`);
    // v1 -> v2: se agregaron los campos table/action/recordId a QueueOperation
    // y meta a QueueFile. Son opcionales, así que los registros v1 ya
    // guardados en el dispositivo de un usuario siguen siendo válidos sin
    // migración de datos - Dexie solo necesita el bump de versión para no
    // rechazar el esquema.
    this.version(1).stores({
      operations: "id, status, type, createdAt",
      files: "id, operationId"
    });
    this.version(2).stores({
      operations: "id, status, type, createdAt, table",
      files: "id, operationId"
    });
    // v3: fieldName indexado - el informe técnico offline necesita ubicar y
    // renombrar el archivo de una foto por su fieldName (temporalmente el
    // clientId de la foto mientras se edita, ver technical-report-form.tsx)
    // antes de encolar la operación final; sin el índice, Dexie no puede
    // resolver un .where("fieldName") y la sincronización nunca llega a
    // completarse.
    this.version(3).stores({
      operations: "id, status, type, createdAt, table",
      files: "id, operationId, fieldName"
    });
  }
}

function sanitizeScopePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "");
}

export function buildScopeKey(authUserId: string, companyId: string): string {
  return `${sanitizeScopePart(authUserId)}_${sanitizeScopePart(companyId)}`;
}

let cachedDb: OfflineDB | null = null;
let cachedScopeKey: string | null = null;

// Una sola instancia viva por scope a la vez - si cambia el scope (otro
// usuario inicia sesión en el mismo dispositivo), se cierra la anterior y se
// abre la base de datos correspondiente al nuevo scope, nunca la misma.
export function getOfflineDb(scopeKey: string): OfflineDB {
  if (cachedDb && cachedScopeKey === scopeKey) return cachedDb;
  if (cachedDb) cachedDb.close();
  cachedDb = new OfflineDB(scopeKey);
  cachedScopeKey = scopeKey;
  return cachedDb;
}
