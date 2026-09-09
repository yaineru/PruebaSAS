// Stub para pruebas: el paquete real "server-only" lanza una excepción
// siempre que se importa fuera del bundler de Next.js (no reconoce el
// entorno de Node de Vitest como "servidor"), aunque el módulo que lo
// importa (lib/security.ts, lib/niches.ts) sea perfectamente testeable en
// Node puro. vitest.config.ts redirige "server-only" a este archivo vacío
// solo dentro de la suite de pruebas - el código de producción sigue
// usando el paquete real.
export {};
