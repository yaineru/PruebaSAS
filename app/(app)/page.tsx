import { AdminRealtimeDashboard } from "@/components/admin-realtime-dashboard";
import { getBusinessLabels, getCompanySettings } from "@/lib/company-settings";
import { getAdminDashboardData } from "@/lib/dashboard";
import { getTenantContext } from "@/lib/tenant";

export default async function DashboardPage() {
  const tenant = await getTenantContext();
  const settings = await getCompanySettings(tenant.companyId, tenant.companyName);
  const initialData = await getAdminDashboardData(tenant.companyId);

  return (
    <AdminRealtimeDashboard
      companyId={tenant.companyId}
      companyName={settings.companyName}
      labels={getBusinessLabels(settings)}
      initialData={initialData}
    />
  );
}
