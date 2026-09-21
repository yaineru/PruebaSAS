"use client";

import Dexie, { type Table } from "dexie";

// Modo offline de campo (Mantenimientos/Novedades/Equipos/Informes técnicos).
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
export type QueueOperationType =
  | "CREATE_MAINTENANCE"
  | "CREATE_INCIDENT"
  | "CREATE_ASSET"
  | "CREATE_TECHNICAL_REPORT";

export type QueueStatus = "PENDING" | "SYNCING" | "SYNCED" | "FAILED";

export type QueueOperation = {
  id: string; // uuid generado en el dispositivo - también es la idempotency key del lado del servidor (client_op_id)
  type: QueueOperationType;
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

export type QueueFile = {
  id: string; // uuid
  operationId: string;
  fieldName: string; // ej. "evidence_0", "technicalSignatureImage"
  blob: Blob;
  mimeType: string;
  fileName: string;
  createdAt: number;
};

export class OfflineDB extends Dexie {
  operations!: Table<QueueOperation, string>;
  files!: Table<QueueFile, string>;

  constructor(scopeKey: string) {
    super(`eos_offline_${scopeKey}`);
    this.version(1).stores({
      operations: "id, status, type, createdAt",
      files: "id, operationId"
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
