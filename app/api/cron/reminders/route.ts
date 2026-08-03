import { NextResponse, type NextRequest } from "next/server";
import { runReminderTick } from "@/lib/scheduler/reminder-scheduler";

// instrumentation.ts's node-cron scheduler only ticks while a long-running
// Node process stays alive - that's true for `next dev`/`next start`, but
// NOT for Vercel's serverless functions, which are invoked per-request and
// have no persistent background process. On a real Vercel deployment the
// in-process cron simply never fires, so reminders (in-app and email) were
// silently never dispatched. Vercel Cron (see vercel.json) instead calls
// this route on a schedule; it's protected by CRON_SECRET so it can't be
// triggered by anyone else (Vercel Cron sends this automatically as a
// Bearer token when CRON_SECRET is set as a project env var).
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }
  }

  const result = await runReminderTick();
  return NextResponse.json(result);
}
