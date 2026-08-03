import { headers } from "next/headers";
import { CalendarDays } from "lucide-react";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { listActivitiesForRange, listActivityTypes } from "@/lib/actions/activities";
import { CalendarView } from "@/components/calendar/calendar-view";
import { CalendarShareSettings } from "@/components/calendar-share-settings";
import { getVisibleRange } from "@/lib/activities/date-utils";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Agenda"
};

export default async function AgendaPage() {
  const tenant = await getTenantContext();
  const supabase = await createClient();

  const { start, end } = getVisibleRange(new Date(), "month");
  const rangeStart = new Date(start);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(end);
  rangeEnd.setHours(23, 59, 59, 999);

  const [initialActivities, activityTypes, { data: companyUsers }, { data: shareLink }] = await Promise.all([
    listActivitiesForRange(tenant.companyId, rangeStart.toISOString(), rangeEnd.toISOString()),
    listActivityTypes(tenant.companyId),
    supabase
      .from("users")
      .select("id, full_name")
      .eq("company_id", tenant.companyId)
      .eq("is_active", true)
      .order("full_name", { ascending: true }),
    supabase
      .from("calendar_share_links")
      .select("ics_token, ics_enabled, public_token, public_enabled, public_visibility")
      .eq("user_id", tenant.userId)
      .maybeSingle()
  ]);

  const headersList = await headers();
  const baseUrl = process.env.APP_URL || `${headersList.get("x-forwarded-proto") ?? "http"}://${headersList.get("host")}`;

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <section>
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
          <CalendarDays className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">Agenda</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
          Programa y da seguimiento a las actividades de la empresa. Arrastra una actividad para cambiar su horario.
        </p>
      </section>

      <CalendarView
        companyId={tenant.companyId}
        initialActivities={initialActivities}
        activityTypes={activityTypes}
        companyUsers={companyUsers || []}
      />

      <CalendarShareSettings share={shareLink ?? null} baseUrl={baseUrl} />
    </div>
  );
}
