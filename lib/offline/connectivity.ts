"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

// `navigator.onLine` solo indica si el sistema operativo tiene una interfaz
// de red activa - una wifi de obra sin salida real a Internet, o un portal
// cautivo, igual reporta `true`. Por eso cada verificación intenta de verdad
// alcanzar nuestro propio servidor (/api/health) con un timeout corto, en
// vez de confiar ciegamente en el navegador.
const HEALTH_CHECK_TIMEOUT_MS = 4000;

async function pingServer(): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    // Si el propio SO ya dice que no hay red, no tiene sentido intentar un
    // fetch (fallaría igual, más lento, y a veces genera ruido en consola).
    return false;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);
  try {
    const response = await fetch("/api/health", {
      method: "GET",
      cache: "no-store",
      signal: controller.signal
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export type ConnectivityState = {
  isOnline: boolean;
  isChecking: boolean;
  recheck: () => Promise<boolean>;
};

export const ConnectivityContext = createContext<ConnectivityState | null>(null);

export function useConnectivityState(): ConnectivityState {
  // Optimista al montar (asume conectado) para no bloquear el primer render
  // con un chequeo de red - la primera verificación real corre de inmediato
  // después y corrige el estado si hace falta.
  const [isOnline, setIsOnline] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const mountedRef = useRef(true);

  const recheck = useCallback(async () => {
    setIsChecking(true);
    const result = await pingServer();
    if (mountedRef.current) {
      setIsOnline(result);
      setIsChecking(false);
    }
    return result;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void recheck();

    const handleOnline = () => void recheck();
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Reintenta periódicamente mientras la pestaña está visible - cubre el
    // caso de recuperar señal sin que el navegador dispare el evento "online"
    // (común en datos móviles con señal intermitente, a diferencia de
    // wifi/ethernet donde el evento es más confiable).
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void recheck();
    }, 20000);

    return () => {
      mountedRef.current = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [recheck]);

  return { isOnline, isChecking, recheck };
}

export function useConnectivity(): ConnectivityState {
  const ctx = useContext(ConnectivityContext);
  if (!ctx) {
    throw new Error("useConnectivity debe usarse dentro de <ConnectivityProvider>.");
  }
  return ctx;
}
