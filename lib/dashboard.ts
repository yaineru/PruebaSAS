import { createClient } from "@/lib/supabase/server";
import { getEnumLabel } from "@/lib/enums";

export type DashboardMetricKey =
  | "totalAssets"
  | "assetsInMaintenance"
  | "availableAssets"
  | "upcomingMaintenance"
  | "openIncidents"
  | "activeProjects"
  | "expiringDocuments"
  | "activeUsers";

export type DashboardData = {
  metrics: Record<DashboardMetricKey, number>;
  assetStatus: Array<{ label: string; value: number }>;
  maintenanceByMonth: Array<{ label: string; value: number }>;
  incidentsByPriority: Array<{ label: string; value: number }>;
  upcomingRows: Array<{ id: string; title: string; due_date: string | null; status: string }>;
  incidentRows: Array<{ id: string; title: string; priority: string; status: string; reported_at: string | null }>;
  alertRows: Array<{ id: string; title: string; priority: string; status: string; trigger_at: string | null }>;
  recentActivity: Array<{ id: string; action: string; table_name: string; created_at: string; users?: { full_name: string | null; email: string | null } | null }>;
};

function countBy<T extends Record<string, unknown>>(rows: T[] | null, key: keyof T, labeler: (value: unknown) => string) {
  const counts = new Map<string, number>();

  for (const row of rows ?? []) {
    const label = labeler(row[key]);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return Array.from(counts, ([label, value]) => ({ label, value }));
}

function emptyDashboard(): DashboardData {
  return {
    metrics: {
      totalAssets: 0,
      assetsInMaintenance: 0,
      availableAssets: 0,
      upcomingMaintenance: 0,
      openIncidents: 0,
      activeProjects: 0,
      expiringDocuments: 0,
      activeUsers: 0
    },
    assetStatus: [],
    maintenanceByMonth: [],
    incidentsByPriority: [],
    upcomingRows: [],
    incidentRows: [],
    alertRows: [],
    recentActivity: []
  };
}

export async function getAdminDashboardData(companyId: string): Promise<DashboardData> {
  const supabase = await createClient();
  const today = new Date();
  const inThirtyDays = new Date(today);
  inThirtyDays.setDate(today.getDate() + 30);
  const sixMonthsAgo = new Date(today);
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

  const responses = [
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
  ];
  const failed = responses.find((response) => response.error);

  if (failed?.error) {
    console.warn("Dashboard query failed", failed.error.message);
  }

  const dashboard = emptyDashboard();

  dashboard.metrics = {
    totalAssets: totalAssets.count ?? 0,
    assetsInMaintenance: assetsInMaintenance.count ?? 0,
    availableAssets: availableAssets.count ?? 0,
    upcomingMaintenance: upcomingMaintenance.count ?? 0,
    openIncidents: openIncidents.count ?? 0,
    activeProjects: activeProjects.count ?? 0,
    expiringDocuments: expiringDocuments.count ?? 0,
    activeUsers: activeUsers.count ?? 0
  };
  dashboard.assetStatus = countBy(assetStatus.data ?? [], "status", (value) => getEnumLabel("assetStatus", value));
  dashboard.incidentsByPriority = countBy(incidentPriorityRows.data ?? [], "priority", (value) => getEnumLabel("incidentPriority", value));
  dashboard.upcomingRows = upcomingRows.data ?? [];
  dashboard.incidentRows = (incidentRows.data ?? []).map((row) => ({
    ...row,
    priority: getEnumLabel("incidentPriority", row.priority),
    status: getEnumLabel("incidentStatus", row.status)
  }));
  dashboard.alertRows = (alertRows.data ?? []).map((row) => ({
    ...row,
    priority: "MEDIA"
  }));
  dashboard.recentActivity = (recentActivity.data ?? []).map((row) => ({
    ...row,
    users: Array.isArray(row.users) ? row.users[0] ?? null : row.users
  }));

  const monthCounts = new Map<string, { label: string; value: number }>();
  for (const row of maintenanceRows.data ?? []) {
    if (!row.maintenance_date) continue;
    const date = new Date(`${row.maintenance_date}T00:00:00`);
    const sortKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = date.toLocaleDateString("es-CO", { month: "short" });
    const existing = monthCounts.get(sortKey);
    monthCounts.set(sortKey, { label, value: (existing?.value ?? 0) + 1 });
  }
  dashboard.maintenanceByMonth = Array.from(monthCounts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, entry]) => entry);

  return dashboard;
}
