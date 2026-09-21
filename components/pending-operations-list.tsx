"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { AlertCircle, CheckCircle2, CloudOff, RefreshCw } from "lucide-react";
import { useOffline } from "@/components/offline-provider";
import { getOfflineDb, type QueueOperationType } from "@/lib/offline/db";
import { Button } from "@/components/ui/button";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendiente de sincronización",
  SYNCING: "Sincronizando...",
  SYNCED: "Sincronizado",
  FAILED: "No se pudo sincronizar"
};

// Muestra, para el módulo actual, los registros creados sin conexión que
// todavía no llegaron a Supabase - la tabla de "Registros recientes" de
// ModulePage solo trae filas que ya existen en el servidor, así que sin esto
// un registro guardado offline sería invisible hasta el próximo sync exitoso,
// dejando al usuario sin la confirmación "quedó pendiente" que pidió.
export function PendingOperationsList({ operationType }: { operationType: QueueOperationType }) {
  const { scopeKey, syncNow, isSyncing } = useOffline();

  const operations = useLiveQuery(async () => {
    const db = getOfflineDb(scopeKey);
    const all = await db.operations.where("type").equals(operationType).sortBy("createdAt");
    // SYNCED se limpia de la vista después de un rato para no acumular una
    // lista infinita, pero no se borra de Dexie de inmediato - queda un rastro
    // corto para que la confirmación de "sincronizado" alcance a verse.
    const cutoff = Date.now() - 5 * 60 * 1000;
    return all.filter((op) => op.status !== "SYNCED" || op.updatedAt > cutoff).reverse();
  }, [scopeKey, operationType]);

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
              <p className="truncate font-medium">{op.summary}</p>
              <p className="text-xs text-muted-foreground">
                {STATUS_LABEL[op.status] ?? op.status}
                {op.status === "FAILED" && op.lastError ? ` · ${op.lastError}` : ""}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
