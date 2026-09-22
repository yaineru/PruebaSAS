"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { AlertCircle, CheckCircle2, CloudOff, RefreshCw, X } from "lucide-react";
import { useOffline } from "@/components/offline-provider";
import { getOfflineDb, LEGACY_CRUD_TABLE, type QueueOperation } from "@/lib/offline/db";
import { discardOperation } from "@/lib/offline/sync";
import { Button } from "@/components/ui/button";
import type { ModuleKey } from "@/lib/modules";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendiente de sincronización",
  SYNCING: "Sincronizando...",
  SYNCED: "Sincronizado",
  FAILED: "No se pudo sincronizar"
};

const ACTION_LABEL: Record<string, string> = {
  CREATE: "Crear",
  UPDATE: "Editar",
  DELETE: "Eliminar"
};

function matchesTable(op: QueueOperation, table: ModuleKey): boolean {
  if (op.type === "CRUD") return op.table === table;
  if (op.type === "CREATE_DOCUMENT") return table === "asset_documents";
  const legacyTable = LEGACY_CRUD_TABLE[op.type];
  return legacyTable === table;
}

function describeOperation(op: QueueOperation): string {
  if (op.type === "CRUD" && op.action && op.action !== "CREATE") {
    return `${ACTION_LABEL[op.action]}: ${op.summary}`;
  }
  return op.summary;
}

// Muestra, para el módulo actual, los registros creados/editados/eliminados
// sin conexión que todavía no llegaron a Supabase - la tabla de "Registros
// recientes" de ModulePage solo trae filas que ya existen en el servidor,
// así que sin esto un cambio guardado offline sería invisible hasta el
// próximo sync exitoso, dejando al usuario sin la confirmación "quedó
// pendiente" que pidió.
export function PendingOperationsList({ table }: { table: ModuleKey }) {
  const { scopeKey, syncNow, isSyncing } = useOffline();

  const operations = useLiveQuery(async () => {
    const db = getOfflineDb(scopeKey);
    // No hay índice compuesto por "table" (las operaciones legacy viven bajo
    // `type`, no `table`) - se trae todo y se filtra en memoria. La cola de
    // un dispositivo de campo es de decenas de elementos, no miles, así que
    // esto es más simple y suficientemente rápido que mantener un índice
    // aparte solo para esta vista.
    const all = await db.operations.toArray();
    const cutoff = Date.now() - 5 * 60 * 1000;
    return all
      .filter((op) => matchesTable(op, table))
      .filter((op) => op.status !== "DRAFT")
      .filter((op) => op.status !== "SYNCED" || op.updatedAt > cutoff)
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [scopeKey, table]);

  if (!operations || operations.length === 0) return null;

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Registrado en este dispositivo</p>
        {operations.some((op) => op.status === "FAILED") ? (
          <Button type="button" size="sm" variant="outline" disabled={isSyncing} onClick={() => void syncNow()}>
            <RefreshCw className="h-3.5 w-3.5" /> Reintentar
          </Button>
        ) : null}
      </div>
      <ul className="space-y-1.5">
        {operations.map((op) => (
          <li key={op.id} className="flex items-center gap-2 rounded-md bg-background px-3 py-2 text-sm">
            {op.status === "SYNCED" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : op.status === "FAILED" ? (
              <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
            ) : op.status === "SYNCING" ? (
              <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-sky-600" />
            ) : (
              <CloudOff className="h-4 w-4 shrink-0 text-amber-600" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{describeOperation(op)}</p>
              <p className="text-xs text-muted-foreground">
                {STATUS_LABEL[op.status] ?? op.status}
                {op.status === "FAILED" && op.lastError ? ` · ${op.lastError}` : ""}
              </p>
            </div>
            {op.status === "FAILED" ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                title="Descartar (no se sincronizará)"
                onClick={() => void discardOperation(scopeKey, op.id)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
