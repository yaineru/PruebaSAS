// Carga perezosa a propósito: importar "@sentry/nextjs" de forma estática
// aquí agregaba ~80 KB al First Load JS de TODAS las páginas (incluida la
// landing pública, la más sensible a peso para tráfico de TikTok en
// celular), incluso con el SDK deshabilitado por falta de DSN. Con el
// import dinámico condicionado a la env var, Next lo separa en un chunk
// aparte que solo se descarga cuando NEXT_PUBLIC_SENTRY_DSN está configurado
// - sin esa variable, el costo es cero.
type SentryModule = typeof import("@sentry/nextjs");

let sentry: SentryModule | null = null;

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0.1
    });
    sentry = Sentry;
  });
}

export function onRouterTransitionStart(...args: Parameters<SentryModule["captureRouterTransitionStart"]>) {
  sentry?.captureRouterTransitionStart(...args);
}
