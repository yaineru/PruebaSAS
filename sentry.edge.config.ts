import * as Sentry from "@sentry/nextjs";

// Cubre middleware.ts y cualquier route handler en runtime edge. Mismo
// no-op seguro sin SENTRY_DSN que sentry.server.config.ts.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: Boolean(process.env.SENTRY_DSN)
});
