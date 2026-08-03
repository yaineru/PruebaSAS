import { NextResponse, type NextRequest } from "next/server";
import { processEmailQueue } from "@/lib/email/mailer";

// Same reasoning as app/api/cron/reminders: retries must be driven by
// Vercel Cron (or an external pinger), not an in-process timer, since
// nothing stays resident between invocations on Vercel.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }
  }

  const result = await processEmailQueue();
  return NextResponse.json(result);
}
