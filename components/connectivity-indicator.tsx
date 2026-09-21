"use client";

import { CheckCircle2, CloudOff, RefreshCw, Wifi } from "lucide-react";
import { useConnectivity } from "@/lib/offline/connectivity";
import { useOffline } from "@/components/offline-provider";

// Indicador pequeño, no invasivo, siempre visible: el trabajador de campo
// debe saber en todo momento qué está pasando con su información, sin tener
// que adivinar si "guardar" realmente guardó algo.
export function ConnectivityIndicator() {
  const { isOnline } = useConnectivity();
  const { pendingCount, syncingCount, failedCount, isSyncing, syncNow } = useOffline();

  if (syncingCount > 0 || isSyncing) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-300 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        Sincronizando{syncingCount > 0 ? ` ${syncingCount}` : ""}...
      </span>
    );
  }

  if (!isOnline) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800"
        title="Los cambios que hagas ahora se guardan en este dispositivo y se enviarán solos cuando vuelva la conexión."
      >
        <CloudOff className="h-3.5 w-3.5" />
        Sin conexión{pendingCount > 0 ? ` · ${pendingCount} pendiente${pendingCount === 1 ? "" : "s"}` : ""}
      </span>
    );
  }

  if (failedCount > 0) {
    return (
      <button
        type="button"
        onClick={() => void syncNow()}
        className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/15"
        title="No pudimos sincronizar algunos registros. Se conservan en este dispositivo - toca para reintentar."
      >
        <CloudOff className="h-3.5 w-3.5" />
        {failedCount} sin sincronizar · Reintentar
      </button>
    );
  }

  if (pendingCount > 0) {
    return (
      <button
        type="button"
        onClick={() => void syncNow()}
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        {pendingCount} por sincronizar
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
      <Wifi className="h-3.5 w-3.5" />
      En línea
    </span>
  );
}

export function SyncedConfirmationIcon() {
  return <CheckCircle2 className="h-3.5 w-3.5" />;
}

// Deja explícito, sin sobre-prometer, qué funciona sin conexión en las
// páginas donde aplica (ver docs/MANUAL_USUARIO_PROGRUAS.md).
export function OfflineScopeNote() {
  return (
    <p className="text-xs text-muted-foreground">
      Disponible sin conexión: consultar equipos ya cargados y registrar mantenimientos o novedades - se guardan en
      este dispositivo y se sincronizan solos al volver la señal.
    </p>
  );
}
