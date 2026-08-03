import "server-only";
import cron from "node-cron";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueEmail } from "@/lib/email/mailer";
import { activityReminderEmail } from "@/lib/email/templates";
import { defaultCompanySettings } from "@/lib/company-settings";

type DueReminder = {
  reminder_id: string;
  activity_id: string;
  company_id: string;
  offset_minutes: number;
  channel: "INAPP" | "EMAIL" | "BOTH";
  title: string;
  start_at: string;
  owner_user_id: string | null;
  owner_email: string | null;
};

function formatOffsetLabel(minutes: number): string {
  if (minutes >= 1440) return "en 1 día";
  if (minutes >= 60) return `en ${Math.round(minutes / 60)} hora(s)`;
  return `en ${minutes} minutos`;
}

/**
 * Runs one reminder-dispatch pass. Idempotent (see the dispatch-log unique
 * constraint below), so it's safe to call from both the local dev cron.schedule
 * loop and the Vercel Cron-triggered route (app/api/cron/reminders) without
 * risking a reminder being sent twice if both happen to fire close together.
 */
export async function runReminderTick() {
  const supabase = createAdminClient();
  const { data: due, error } = await supabase.rpc("get_due_reminders");

  if (error) {
    console.error("REMINDER_SCHEDULER_QUERY_FAILED", error.message);
    return { success: false, error: error.message };
  }

  let dispatched = 0;

  for (const reminder of (due || []) as DueReminder[]) {
    // Insert into the dispatch log FIRST - the unique(activity_id, offset_minutes)
    // constraint is the idempotency lock. If this conflicts (23505), another
    // tick (or another process instance) already claimed this reminder, so it's
    // safely skipped rather than dispatched twice.
    const { error: claimError } = await supabase.from("reminder_dispatch_log").insert({
      activity_id: reminder.activity_id,
      offset_minutes: reminder.offset_minutes,
    });

    if (claimError) {
      if (claimError.code !== "23505") {
        console.error("REMINDER_DISPATCH_LOG_INSERT_FAILED", claimError.message);
      }
      continue;
    }

    const message = `"${reminder.title}" comienza ${formatOffsetLabel(reminder.offset_minutes)}.`;

    if (reminder.owner_user_id) {
      const { error: notifyError } = await supabase.from("notifications").insert({
        company_id: reminder.company_id,
        user_id: reminder.owner_user_id,
        title: "Recordatorio de actividad",
        message,
        event_type: "ACTIVITY_REMINDER",
        entity_table: "activities",
        entity_id: reminder.activity_id,
      });
      if (notifyError) {
        console.error("REMINDER_NOTIFICATION_INSERT_FAILED", notifyError.message);
      }
    }

    if ((reminder.channel === "EMAIL" || reminder.channel === "BOTH") && reminder.owner_email) {
      const { data: companySettingsRow } = await supabase
        .from("company_settings")
        .select("company_name, primary_color, logo_url")
        .eq("company_id", reminder.company_id)
        .maybeSingle();
      const fallback = defaultCompanySettings(reminder.company_id);
      const { subject, html } = activityReminderEmail(
        {
          companyName: companySettingsRow?.company_name ?? fallback.companyName,
          primaryColor: companySettingsRow?.primary_color ?? fallback.primaryColor,
          logoUrl: companySettingsRow?.logo_url ?? null
        },
        { title: reminder.title, whenLabel: `comienza ${formatOffsetLabel(reminder.offset_minutes)}` }
      );

      await enqueueEmail({
        companyId: reminder.company_id,
        to: reminder.owner_email,
        subject,
        html,
        templateKey: "activity_reminder"
      });
    }

    dispatched += 1;
  }

  return { success: true, dispatched };
}

/**
 * Starts the in-process reminder scheduler (checks every minute) for local
 * development only (`next dev`/`next start` keep a persistent Node process
 * alive). In production this app runs on Vercel, where serverless functions
 * don't stay resident, so this loop would never reliably tick there -
 * app/api/cron/reminders + vercel.json's Cron config is the real production
 * mechanism. Calling both is harmless: runReminderTick() is idempotent
 * (dispatch-log unique constraint), so double-ticking never double-sends.
 * Safe to call multiple times - a globalThis flag prevents a second
 * cron.schedule() across Next.js dev-mode Fast Refresh module reloads (a
 * module-scope variable would not survive those the same way). See
 * instrumentation.ts for the single call site.
 */
export function startReminderScheduler() {
  if (process.env.VERCEL) return;

  const globalState = globalThis as typeof globalThis & { __reminderCronStarted?: boolean };
  if (globalState.__reminderCronStarted) return;
  globalState.__reminderCronStarted = true;

  cron.schedule("* * * * *", () => {
    runReminderTick().catch((error) => {
      console.error("REMINDER_SCHEDULER_TICK_FAILED", error instanceof Error ? error.message : error);
    });
  });

  console.log("Reminder scheduler started (checking every minute).");
}
