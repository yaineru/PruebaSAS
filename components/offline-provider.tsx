"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ConnectivityContext, useConnectivityState } from "@/lib/offline/connectivity";
import { buildScopeKey, getOfflineDb } from "@/lib/offline/db";
import { processQueue } from "@/lib/offline/sync";

type OfflineContextValue = {
  scopeKey: string;
  pendingCount: number;
  syncingCount: number;
  failedCount: number;
  isSyncing: boolean;
  syncNow: () => void;
};

const OfflineContext = createContext<OfflineContextValue | null>(null);

export function useOffline(): OfflineContextValue {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error("useOffline debe usarse dentro de <OfflineProvider>.");
  return ctx;
}

// Punto único que arma el scope (usuario+empresa) y dispara la sincronización
// automática al recuperar conexión real. Se monta una vez en AppShell -
// todas las páginas autenticadas quedan cubiertas sin que cada módulo tenga
// que preocuparse por esto.
export function OfflineProvider({
  authUserId,
  companyId,
  children
}: {
  authUserId: string;
  companyId: string;
  children: React.ReactNode;
}) {
  const scopeKey = buildScopeKey(authUserId, companyId);
  const connectivity = useConnectivityState();
  const [isSyncing, setIsSyncing] = useState(false);
  const wasOnlineRef = useRef(connectivity.isOnline);

  const counts = useLiveQuery(async () => {
    const db = getOfflineDb(scopeKey);
    const [pending, syncing, failed] = await Promise.all([
      db.operations.where("status").equals("PENDING").count(),
      db.operations.where("status").equals("SYNCING").count(),
      db.operations.where("status").equals("FAILED").count()
    ]);
    return { pending, syncing, failed };
  }, [scopeKey]);

  async function syncNow() {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await processQueue(scopeKey);
    } finally {
      setIsSyncing(false);
    }
  }

  useEffect(() => {
    // Dispara la sincronización automáticamente en la transición real
    // offline -> online (no en cada re-render, ni al montar si ya estaba
    // online desde el principio - eso lo cubre el chequeo manual/el botón).
    if (connectivity.isOnline && !wasOnlineRef.current) {
      void syncNow();
    }
    wasOnlineRef.current = connectivity.isOnline;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectivity.isOnline, scopeKey]);

  const triedInitialSyncRef = useRef(false);

  useEffect(() => {
    // Si ya hay pendientes al abrir (ej. se cerró la app con la cola sin
    // vaciar, o se recargó estando ya online) intenta sincronizar una vez.
    // `counts` llega de forma asíncrona (useLiveQuery): no basta con correr
    // esto solo al montar, hay que esperar el conteo real. Y no hay que
    // confiar en `connectivity.isOnline` acá - al montar todavía puede tener
    // el valor optimista por defecto mientras el ping real está en camino -
    // se pide un chequeo fresco explícito antes de decidir.
    // También cuenta `syncing`: una operación que quedó en SYNCING viene de
    // una sesión anterior interrumpida a mitad de envío (una pestaña nueva
    // nunca puede tener algo genuinamente "en curso" todavía) - processQueue
    // la reclama de vuelta a PENDING antes de reintentar (ver lib/offline/sync.ts).
    if (triedInitialSyncRef.current) return;
    if (counts === undefined) return;
    triedInitialSyncRef.current = true;
    if (counts.pending === 0 && counts.syncing === 0) return;
    void (async () => {
      const isOnline = await connectivity.recheck();
      if (isOnline) void syncNow();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey, counts]);

  return (
    <ConnectivityContext.Provider value={connectivity}>
      <OfflineContext.Provider
        value={{
          scopeKey,
          pendingCount: counts?.pending ?? 0,
          syncingCount: counts?.syncing ?? 0,
          failedCount: counts?.failed ?? 0,
          isSyncing,
          syncNow
        }}
      >
        {children}
      </OfflineContext.Provider>
    </ConnectivityContext.Provider>
  );
}
