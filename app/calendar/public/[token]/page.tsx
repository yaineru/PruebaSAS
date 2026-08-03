import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, formatTime } from "@/lib/utils";

export const metadata = { title: "Disponibilidad" };

type PageProps = { params: Promise<{ token: string }> };

// Public, unauthenticated page (see middleware.ts's isPublicRoute carve-out).
// Resolves strictly by the opaque public_token via the admin client - never
// trusts a company/user id from the URL, so there is no way to enumerate or
// cross company boundaries by guessing an id.
export default async function PublicCalendarPage({ params }: PageProps) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: share } = await admin
    .from("calendar_share_links")
    .select("user_id, company_id, public_enabled, public_visibility")
    .eq("public_token", token)
    .maybeSingle();

  if (!share || !share.public_enabled) {
    notFound();
  }

  const [{ data: user }, { data: companySettings }] = await Promise.all([
    admin.from("users").select("full_name").eq("id", share.user_id).maybeSingle(),
    admin.from("company_settings").select("company_name, primary_color, logo_url").eq("company_id", share.company_id).maybeSingle()
  ]);

  const today = new Date();
  const in14Days = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const { data: activities } = await admin
    .from("activities")
    .select("id, title, description, location, start_at, end_at, all_day, status")
    .eq("company_id", share.company_id)
    .eq("owner_user_id", share.user_id)
    .eq("status", "SCHEDULED")
    .eq("is_private", false)
    .is("deleted_at", null)
    .gte("start_at", today.toISOString())
    .lte("start_at", in14Days.toISOString())
    .order("start_at", { ascending: true })
    .limit(100);

  const color = companySettings?.primary_color && /^#[0-9A-Fa-f]{6}$/.test(companySettings.primary_color)
    ? companySettings.primary_color
    : "#0f172a";

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", padding: "2rem 1rem" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", background: "#ffffff", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" }}>
        <div style={{ background: color, padding: "1.25rem 1.5rem", color: "#fff" }}>
          <p style={{ margin: 0, fontSize: 12, opacity: 0.85, textTransform: "uppercase", letterSpacing: "0.05em" }}>Disponibilidad</p>
          <h1 style={{ margin: "0.25rem 0 0", fontSize: 20 }}>{user?.full_name ?? "Usuario"}</h1>
        </div>
        <div style={{ padding: "1.5rem" }}>
          {(activities ?? []).length === 0 ? (
            <p style={{ color: "#64748b", fontSize: 14 }}>Sin actividades programadas en los próximos 14 días.</p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {(activities ?? []).map((activity) => (
                <li key={activity.id} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "0.75rem 1rem" }}>
                  <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
                    {formatDate(activity.start_at)}
                    {!activity.all_day ? ` · ${formatTime(activity.start_at)}–${formatTime(activity.end_at)}` : " · Todo el día"}
                  </p>
                  {share.public_visibility === "BUSY" ? (
                    <p style={{ margin: "0.25rem 0 0", fontWeight: 600 }}>Ocupado</p>
                  ) : (
                    <>
                      <p style={{ margin: "0.25rem 0 0", fontWeight: 600 }}>{activity.title}</p>
                      {share.public_visibility === "FULL" && activity.location ? (
                        <p style={{ margin: "0.25rem 0 0", fontSize: 13, color: "#64748b" }}>📍 {activity.location}</p>
                      ) : null}
                      {share.public_visibility === "FULL" && activity.description ? (
                        <p style={{ margin: "0.25rem 0 0", fontSize: 13, color: "#64748b" }}>{activity.description}</p>
                      ) : null}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div style={{ padding: "0.75rem 1.5rem", background: "#f8fafc", borderTop: "1px solid #e2e8f0", fontSize: 12, color: "#94a3b8" }}>
          {companySettings?.company_name ?? "EmpresaOS"} · Página pública de disponibilidad
        </div>
      </div>
    </div>
  );
}
