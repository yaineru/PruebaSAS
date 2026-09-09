export async function register() {
  // instrumentation.ts runs once for both the Node and the Edge compilation
  // passes (this repo has middleware.ts on the edge runtime) - without this
  // guard, importing node-cron/the admin Supabase client into the edge
  // bundle would crash the build/boot since those are Node-only.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startReminderScheduler } = await import("@/lib/scheduler/reminder-scheduler");
    startReminderScheduler();
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = async (...args: Parameters<typeof import("@sentry/nextjs").captureRequestError>) => {
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
};
