"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Boxes,
  CalendarClock,
  FileWarning,
  FolderKanban,
  PackageCheck,
  UsersRound,
  Wrench
} from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import type { BusinessLabels } from "@/lib/company-settings";
import type { DashboardData, DashboardMetricKey } from "@/lib/dashboard";
import { getEnumLabel } from "@/lib/enums";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AssetStatusChart } from "@/components/asset-status-chart";
import { IncidentPriorityChart } from "@/components/incident-priority-chart";
import { MaintenanceTimelineChart } from "@/components/maintenance-timeline-chart";

type Props = {
  companyId: string;
  companyName: string;
  labels: BusinessLabels;
  initialData: DashboardData;
};

function actionText(action: string, table: string) {
  const verbs: Record<string, string> = {
    INSERT: "creó",
    UPDATE: "actualizó",
    DELETE: "eliminó",
    LOGIN: "inició sesión",
    LOGOUT: "cerró sesión",
    PERMISSION_DENIED: "tuvo un intento denegado"
  };
  const tables: Record<string, string> = {
    assets: "maquinaria",
    maintenance_records: "mantenimiento",
    asset_documents: "documento",
    incidents: "novedad",
    projects: "obra",
    users: "usuario",
    asset_assignments: "asignacion",
    activities: "actividad",
    generated_reports: "informe",
    report_templates: "plantilla de informe",
    report_schedules: "programación de informe",
    notifications: "notificación",
    email_settings: "configuración de correo",
    calendar_share_links: "enlace de calendario",
    activity_attachments: "adjunto de actividad",
    maintenance_alerts: "alerta de mantenimiento",
    company_settings: "configuración de empresa"
  };

  return `${verbs[action] ?? "registro actividad en"} ${tables[table] ?? table}`;
}

export function AdminRealtimeDashboard({ companyId, companyName, labels, initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const refreshData = useCallback(async () => {
    try {
      const today = new Date();
      const inThirtyDays = new Date(today);
      const sixMonthsAgo = new Date(today);
      inThirtyDays.setDate(today.getDate() + 30);
      sixMonthsAgo.setMonth(today.getMonth() - 5);
      const todayIso = today.toISOString().slice(0, 10);
      const nextIso = inThirtyDays.toISOString().slice(0, 10);
      const sixMonthsAgoIso = sixMonthsAgo.toISOString().slice(0, 10);

      const [
        totalAssets,
        assetsInMaintenance,
        availableAssets,
        upcomingMaintenance,
        openIncidents,
        activeProjects,
        expiringDocuments,
        activeUsers,
        assetStatus,
        maintenanceRows,
        incidentPriorityRows,
        upcomingRows,
        incidentRows,
        alertRows,
        recentActivity
      ] = await Promise.all([
        supabase.from("assets").select("id", { count: "exact", head: true }).eq("company_id", companyId),
        supabase.from("assets").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "MAINTENANCE"),
        supabase.from("assets").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "AVAILABLE"),
        supabase.from("maintenance_records").select("id", { count: "exact", head: true }).eq("company_id", companyId).gte("due_date", todayIso).lte("due_date", nextIso).in("status", ["SCHEDULED", "IN_PROGRESS", "PENDING"]),
        supabase.from("incidents").select("id", { count: "exact", head: true }).eq("company_id", companyId).in("status", ["ABIERTO", "EN_PROCESO"]),
        supabase.from("projects").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "ACTIVE"),
        supabase.from("asset_documents").select("id", { count: "exact", head: true }).eq("company_id", companyId).gte("expires_at", todayIso).lte("expires_at", nextIso),
        supabase.from("users").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("is_active", true),
        supabase.from("assets").select("status").eq("company_id", companyId).limit(1000),
        supabase.from("maintenance_records").select("maintenance_date").eq("company_id", companyId).gte("maintenance_date", sixMonthsAgoIso).order("maintenance_date", { ascending: true }).limit(1000),
        supabase.from("incidents").select("priority").eq("company_id", companyId).limit(1000),
        supabase.from("maintenance_records").select("id,title,due_date,status").eq("company_id", companyId).gte("due_date", todayIso).order("due_date", { ascending: true }).limit(6),
        supabase.from("incidents").select("id,title,priority,status,reported_at").eq("company_id", companyId).order("reported_at", { ascending: false }).limit(6),
        supabase.from("maintenance_alerts").select("id,title,status,trigger_at").eq("company_id", companyId).order("trigger_at", { ascending: true }).limit(6),
        supabase.from("audit_logs").select("id,action,table_name,created_at,users(full_name,email)").eq("company_id", companyId).order("created_at", { ascending: false }).limit(8)
      ]);

      const failed = [
        totalAssets,
        assetsInMaintenance,
        availableAssets,
        upcomingMaintenance,
        openIncidents,
        activeProjects,
        expiringDocuments,
        activeUsers,
        assetStatus,
        maintenanceRows,
        incidentPriorityRows,
        upcomingRows,
        incidentRows,
        alertRows,
        recentActivity
      ].find((response) => response.error);

      if (failed?.error) {
        console.warn("Dashboard refresh failed", failed.error.message);
      }

      const countBy = (rows: Array<Record<string, unknown>>, key: string, labeler: (value: unknown) => string) => {
        const counts = new Map<string, number>();
        for (const row of rows) {
          const label = labeler(row[key]);
          counts.set(label, (counts.get(label) ?? 0) + 1);
        }
        return Array.from(counts, ([label, value]) => ({ label, value }));
      };

      const monthCounts = new Map<string, { label: string; value: number }>();
      for (const row of maintenanceRows.data ?? []) {
        if (!row.maintenance_date) continue;
        const date = new Date(`${row.maintenance_date}T00:00:00`);
        const sortKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const label = date.toLocaleDateString("es-CO", { month: "short" });
        const existing = monthCounts.get(sortKey);
        monthCounts.set(sortKey, { label, value: (existing?.value ?? 0) + 1 });
      }

      setData({
        metrics: {
          totalAssets: totalAssets.count ?? 0,
          assetsInMaintenance: assetsInMaintenance.count ?? 0,
          availableAssets: availableAssets.count ?? 0,
          upcomingMaintenance: upcomingMaintenance.count ?? 0,
          openIncidents: openIncidents.count ?? 0,
          activeProjects: activeProjects.count ?? 0,
          expiringDocuments: expiringDocuments.count ?? 0,
          activeUsers: activeUsers.count ?? 0
        },
        assetStatus: countBy(assetStatus.data ?? [], "status", (value) => getEnumLabel("assetStatus", value)),
        maintenanceByMonth: Array.from(monthCounts.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([, entry]) => entry),
        incidentsByPriority: countBy(incidentPriorityRows.data ?? [], "priority", (value) => getEnumLabel("incidentPriority", value)),
        upcomingRows: upcomingRows.data ?? [],
        incidentRows: (incidentRows.data ?? []).map((row) => ({
          ...row,
          priority: getEnumLabel("incidentPriority", row.priority),
          status: getEnumLabel("incidentStatus", row.status)
        })),
        alertRows: (alertRows.data ?? []).map((row) => ({
          ...row,
          priority: "MEDIA"
        })),
        recentActivity: (recentActivity.data ?? []).map((row) => ({
          ...row,
          users: Array.isArray(row.users) ? row.users[0] ?? null : row.users
        }))
      });
      setLastSync(new Date());
    } catch (error) {
      console.warn("Dashboard refresh failed", error);
    }
  }, [companyId, supabase]);

  // Each of the 9 subscribed tables can fire its own postgres_changes event
  // for the same underlying action (e.g. creating an incident also touches
  // notifications and audit_logs), and a bulk operation (import, batch
  // update) can fire dozens of events within milliseconds - each one used to
  // trigger its own independent 15-query refreshData() call. Debouncing
  // coalesces a burst of events into a single refetch a moment after things
  // go quiet, instead of one refetch per event; the dashboard still updates
  // live, just without doing the same 15 queries N times for one bulk action.
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => void refreshData(), 1200);
  }, [refreshData]);

  useEffect(() => {
    const tables = [
      "assets",
      "maintenance_records",
      "maintenance_alerts",
      "projects",
      "asset_assignments",
      "asset_documents",
      "notifications",
      "incidents",
      "audit_logs"
    ];
    const channel = supabase.channel(`panel-general:${companyId}`);

    for (const table of tables) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `company_id=eq.${companyId}` },
        () => scheduleRefresh()
      );
    }

    channel.subscribe((status) => {
      if (status === "CHANNEL_ERROR") console.warn("Dashboard realtime channel error");
    });

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      void supabase.removeChannel(channel);
    };
  }, [companyId, scheduleRefresh, supabase]);

  const metrics = data.metrics;
  const assetStatus = data.assetStatus ?? [];
  const maintenanceByMonth = data.maintenanceByMonth ?? [];
  const incidentsByPriority = data.incidentsByPriority ?? [];
  const upcomingRows = data.upcomingRows ?? [];
  const incidentRows = data.incidentRows ?? [];
  const alertRows = data.alertRows ?? [];
  const recentActivity = data.recentActivity ?? [];
  const metricConfig: Array<{ key: DashboardMetricKey; label: string; icon: typeof Boxes }> = [
    { key: "totalAssets", label: `${labels.assetLabel} totales`, icon: Boxes },
    { key: "availableAssets", label: "Disponibles", icon: PackageCheck },
    { key: "assetsInMaintenance", label: "En seguimiento", icon: Wrench },
    { key: "openIncidents", label: `${labels.incidentLabel} abiertas`, icon: AlertTriangle },
    { key: "activeProjects", label: `${labels.projectLabel} activos`, icon: FolderKanban },
    { key: "upcomingMaintenance", label: `${labels.maintenanceLabel} próximos`, icon: CalendarClock },
    { key: "expiringDocuments", label: "Documentos por vencer", icon: FileWarning },
    { key: "activeUsers", label: "Usuarios activos", icon: UsersRound }
  ];

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <section className="rounded-md border bg-card p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Badge>Tiempo real activo</Badge>
              <span className="text-xs text-muted-foreground">
                {lastSync ? `Actualizado ${lastSync.toLocaleTimeString("es-CO")}` : "Esperando cambios"}
              </span>
            </div>
            <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">
              Panel general de {companyName}
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground sm:text-base">
              Indicadores ejecutivos de {labels.assetLabel.toLowerCase()}, {labels.projectLabel.toLowerCase()}, documentos y {labels.incidentLabel.toLowerCase()}.
            </p>
          </div>
          <Activity className="hidden h-12 w-12 text-primary lg:block" />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricConfig.map((metric) => (
          <Card key={metric.key}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardDescription>{metric.label}</CardDescription>
                <metric.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{metrics[metric.key] ?? 0}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <AssetStatusChart data={assetStatus} />
        <MaintenanceTimelineChart data={maintenanceByMonth} />
        <IncidentPriorityChart data={incidentsByPriority} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{labels.maintenanceLabel} próximos</CardTitle>
            <CardDescription>Actividades ordenadas por fecha comprometida.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveTable
              empty={`No hay ${labels.maintenanceLabel.toLowerCase()} próximos.`}
              rows={upcomingRows}
              columns={[
                { label: "Actividad", render: (row) => <span className="font-medium">{row.title}</span> },
                { label: "Fecha", render: (row) => formatDate(row.due_date) },
                { label: "Estado", render: (row) => <Badge variant="secondary">{getEnumLabel("maintenanceStatus", row.status)}</Badge> }
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actividad reciente</CardTitle>
            <CardDescription>Eventos empresariales registrados automáticamente.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentActivity.length === 0 ? (
              <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                Aún no hay actividad registrada.
              </p>
            ) : (
              recentActivity.map((item) => (
                <div className="rounded-md border p-3" key={item.id}>
                  <p className="text-sm font-medium">
                    {item.users?.full_name ?? item.users?.email ?? "Sistema"} {actionText(item.action, item.table_name)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(item.created_at)}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{labels.incidentLabel} recientes</CardTitle>
            <CardDescription>Seguimiento de reportes abiertos o en proceso.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveTable
              empty={`No hay ${labels.incidentLabel.toLowerCase()} recientes.`}
              rows={incidentRows}
              columns={[
                { label: "Registro", render: (row) => <span className="font-medium">{row.title}</span> },
                { label: "Prioridad", render: (row) => <Badge variant={row.priority === "Critica" ? "destructive" : "warning"}>{row.priority}</Badge> },
                { label: "Estado", render: (row) => row.status }
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alertas importantes</CardTitle>
            <CardDescription>Mantenimientos y vencimientos que requieren seguimiento.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveTable
              empty="No hay alertas activas."
              rows={alertRows}
              columns={[
                { label: "Alerta", render: (row) => <span className="font-medium">{row.title}</span> },
                { label: "Fecha", render: (row) => formatDate(row.trigger_at) },
                { label: "Prioridad", render: (row) => <Badge variant={row.priority === "Critica" ? "destructive" : "warning"}>{row.priority}</Badge> }
              ]}
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function ResponsiveTable<T extends { id: string }>({
  rows,
  columns,
  empty
}: {
  rows: T[];
  empty: string;
  columns: Array<{ label: string; render: (row: T) => React.ReactNode }>;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        {empty}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.label}>{column.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              {columns.map((column) => (
                <TableCell key={column.label}>{column.render(row)}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
