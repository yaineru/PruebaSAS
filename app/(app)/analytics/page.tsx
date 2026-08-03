import { notFound } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { AnalyticsDashboard } from "@/components/analytics-dashboard";
import type { AnalyticsDashboardData, AnalyticsMetric } from "@/lib/notifications";

export const metadata = {
  title: "Analytics"
};

function groupByDay(rows: Array<{ date: string | null }>, companyId: string): AnalyticsMetric[] {
  const counts = new Map<string, number>();

  for (const row of rows) {
    if (!row.date) continue;
    const day = row.date.slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([metricDate, metricValue]) => ({
      metricName: "",
      metricDate,
      metricValue,
      companyId,
      id: metricDate,
      createdAt: metricDate
    }));
}

export default async function AnalyticsPage() {
  const tenant = await getTenantContext();
  const supabase = await createClient();

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Los contadores se calculan en vivo desde las tablas reales del negocio
    // (generated_reports, incidents, maintenance_records, users), no desde
    // analytics_metrics: esa tabla nunca es alimentada por ningún proceso.
    const [
      reportsRows,
      incidentsRows,
      activeUsersCount,
      maintenanceCompletedCount,
      eventsData
    ] = await Promise.all([
      supabase
        .from("generated_reports")
        .select("created_at")
        .eq("company_id", tenant.companyId)
        .gte("created_at", thirtyDaysAgo),

      supabase
        .from("incidents")
        .select("reported_at")
        .eq("company_id", tenant.companyId)
        .gte("reported_at", thirtyDaysAgo),

      supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("company_id", tenant.companyId)
        .eq("is_active", true),

      supabase
        .from("maintenance_records")
        .select("id", { count: "exact", head: true })
        .eq("company_id", tenant.companyId)
        .eq("status", "COMPLETED"),

      supabase
        .from("analytics_events")
        .select("event_name, user_id")
        .eq("company_id", tenant.companyId)
        .gte("created_at", thirtyDaysAgo)
    ]);

    const reportsGenerated = groupByDay(
      (reportsRows.data || []).map((r) => ({ date: r.created_at })),
      tenant.companyId
    );
    const incidentsCreated = groupByDay(
      (incidentsRows.data || []).map((r) => ({ date: r.reported_at })),
      tenant.companyId
    );

    // Process events for top features
    const eventCounts: Record<string, number> = {};
    (eventsData.data || []).forEach((event) => {
      eventCounts[event.event_name] = (eventCounts[event.event_name] || 0) + 1;
    });

    const topFeatures = Object.entries(eventCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([feature, count]) => ({ feature, count }));

    const uniqueUsers = new Set((eventsData.data || []).map((entry) => entry.user_id).filter(Boolean)).size;

    const dashboardData: AnalyticsDashboardData = {
      reportsGenerated,
      incidentsCreated,
      activeUsers: [
        {
          metricName: "USERS_ACTIVE",
          metricDate: new Date().toISOString().slice(0, 10),
          metricValue: activeUsersCount.count || 0,
          companyId: tenant.companyId,
          id: "active-users",
          createdAt: new Date().toISOString()
        }
      ],
      maintenanceCompleted: [
        {
          metricName: "MAINTENANCE_COMPLETED",
          metricDate: new Date().toISOString().slice(0, 10),
          metricValue: maintenanceCompletedCount.count || 0,
          companyId: tenant.companyId,
          id: "maintenance-completed",
          createdAt: new Date().toISOString()
        }
      ],
      topFeatures,
      userEngagement: {
        totalEvents: eventsData.data?.length || 0,
        uniqueUsers,
        averageSessionDuration: 1800 // Estimado por defecto: 30 minutos
      }
    };

    return (
      <div className="space-y-6">
        <section>
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
            <BarChart3 className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">Analytics</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Visualiza métricas de uso, actividad y adopción de funcionalidades en tu plataforma.
          </p>
        </section>

        <AnalyticsDashboard data={dashboardData} />
      </div>
    );
  } catch (error) {
    console.error("Analytics page error", error);
    notFound();
  }
}
