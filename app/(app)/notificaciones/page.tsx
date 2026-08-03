import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { NotificationCenter } from "@/components/notification-center";

export const metadata = {
  title: "Notificaciones"
};

export default async function NotificationsPage() {
  const tenant = await getTenantContext();
  const supabase = await createClient();

  // Load initial notifications
  const { data: notifications, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("company_id", tenant.companyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Failed to load notifications", error);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/10 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Notificaciones</h1>
          <p className="text-muted-foreground mt-2">
            Centro de notificaciones en tiempo real
          </p>
        </div>

        <NotificationCenter companyId={tenant.companyId} initialNotifications={notifications || []} />
      </div>
    </div>
  );
}
