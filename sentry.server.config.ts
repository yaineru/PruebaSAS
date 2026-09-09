import * as Sentry from "@sentry/nextjs";

// Sin SENTRY_DSN configurado, Sentry.init() con dsn vacío queda como no-op
// seguro (no lanza, no envía nada) - así que este archivo puede desplegarse
// ya, y el monitoreo se activa el día que agregues la variable de entorno en
// Vercel, sin tocar código de nuevo.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  // Antes de esta corrección no existía ninguna forma de enterarse de un
  // error real de producción salvo que el propio cliente escribiera a
  // soporte - ver auditoría de lanzamiento. Sin sampling agresivo de
  // performance (no es el objetivo), solo captura de errores.
  enabled: Boolean(process.env.SENTRY_DSN)
});
