"use client";

import { useEffect } from "react";

// Registrado en el layout raíz (no solo en el área autenticada) para que el
// Service Worker ya esté activo y cacheando páginas desde la primera visita
// - si solo se registrara dentro del panel, la primera apertura offline de
// alguien que nunca inició sesión en ese dispositivo no tendría nada que
// servir. Ver public/sw.js para la estrategia de cacheo real.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("No se pudo registrar el Service Worker (modo offline limitado)", error);
    });
  }, []);

  return null;
}
