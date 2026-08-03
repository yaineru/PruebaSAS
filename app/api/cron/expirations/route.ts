import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueEmail } from "@/lib/email/mailer";
import { documentExpiringEmail, maintenanceDueEmail } from "@/lib/email/templates";
import { defaultCompanySettings } from "@/lib/company-settings";
import { formatDate } from "@/lib/utils";

// Deliberately NOT implemented as a callable Postgres RPC (unlike the
// pre-existing generate_document_expiration_notifications()/
// generate_operational_expiration_notifications() functions, which a prior
// audit found were callable by any authenticated user of any company since
// EXECUTE was never revoked from PUBLIC - see migration 033). This route is
// the only caller of this logic, it's cron/CRON_SECRET-gated, and it scopes
// every notification/email strictly per company as it iterates - there is
// no PostgREST-exposed surface for a user to trigger a cross-tenant scan.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }
  }

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  let documentsNotified = 0;
  let maintenanceNotified = 0;

  const { data: expiringDocuments } = await admin
    .from("asset_documents")
    .select("id, company_id, title, expires_at, asset:assets(name)")
    .gte("expires_at", today)
    .lte("expires_at", in30Days)
    .is("deleted_at", null);

  for (const doc of expiringDocuments ?? []) {
    const { data: alreadyNotified } = await admin
      .from("notifications")
      .select("id")
      .eq("entity_table", "asset_documents")
      .eq("entity_id", doc.id)
      .eq("event_type", "DOCUMENT_EXPIRING")
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .maybeSingle();
    if (alreadyNotified) continue;

    const assetName = Array.isArray(doc.asset) ? doc.asset[0]?.name : (doc.asset as { name?: string } | null)?.name;

    await admin.from("notifications").insert({
      company_id: doc.company_id,
      user_id: null,
      title: "Documento próximo a vencer",
      message: `"${doc.title}" vence el ${formatDate(doc.expires_at)}.`,
      event_type: "DOCUMENT_EXPIRING",
      entity_table: "asset_documents",
      entity_id: doc.id
    });
    documentsNotified += 1;

    await notifySubscribers(admin, doc.company_id, "DOCUMENT_EXPIRING", async (email, brand) => {
      const { subject, html } = documentExpiringEmail(brand, {
        documentTitle: doc.title,
        expiresOnLabel: formatDate(doc.expires_at),
        assetName
      });
      await enqueueEmail({ companyId: doc.company_id, to: email, subject, html, templateKey: "document_expiring" });
    });
  }

  const { data: dueMaintenance } = await admin
    .from("maintenance_records")
    .select("id, company_id, title, due_date, status, asset:assets(name)")
    .gte("due_date", today)
    .lte("due_date", in7Days)
    .in("status", ["SCHEDULED", "PENDING"]);

  for (const record of dueMaintenance ?? []) {
    const { data: alreadyNotified } = await admin
      .from("notifications")
      .select("id")
      .eq("entity_table", "maintenance_records")
      .eq("entity_id", record.id)
      .eq("event_type", "MAINTENANCE_DUE")
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .maybeSingle();
    if (alreadyNotified) continue;

    const assetName = Array.isArray(record.asset) ? record.asset[0]?.name : (record.asset as { name?: string } | null)?.name;

    await admin.from("notifications").insert({
      company_id: record.company_id,
      user_id: null,
      title: "Mantenimiento próximo",
      message: `"${record.title}"${assetName ? ` (${assetName})` : ""} programado para el ${formatDate(record.due_date)}.`,
      event_type: "MAINTENANCE_DUE",
      entity_table: "maintenance_records",
      entity_id: record.id
    });
    maintenanceNotified += 1;

    await notifySubscribers(admin, record.company_id, "MAINTENANCE_DUE", async (email, brand) => {
      const { subject, html } = maintenanceDueEmail(brand, {
        assetName: assetName || record.title,
        dueDateLabel: formatDate(record.due_date)
      });
      await enqueueEmail({ companyId: record.company_id, to: email, subject, html, templateKey: "maintenance_due" });
    });
  }

  return NextResponse.json({ documentsNotified, maintenanceNotified });
}

async function notifySubscribers(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  eventType: string,
  send: (email: string, brand: { companyName: string; primaryColor: string; logoUrl: string | null }) => Promise<void>
) {
  const { data: subscribers } = await admin
    .from("email_subscriptions")
    .select("user_id, users:user_id(email)")
    .eq("company_id", companyId)
    .eq("event_type", eventType)
    .eq("enabled", true)
    .eq("frequency", "IMMEDIATE");

  if (!subscribers || subscribers.length === 0) return;

  const { data: settingsRow } = await admin
    .from("company_settings")
    .select("company_name, primary_color, logo_url")
    .eq("company_id", companyId)
    .maybeSingle();
  const fallback = defaultCompanySettings(companyId);
  const brand = {
    companyName: settingsRow?.company_name ?? fallback.companyName,
    primaryColor: settingsRow?.primary_color ?? fallback.primaryColor,
    logoUrl: settingsRow?.logo_url ?? null
  };

  for (const subscriber of subscribers) {
    const email = Array.isArray(subscriber.users) ? subscriber.users[0]?.email : (subscriber.users as { email?: string } | null)?.email;
    if (email) await send(email, brand);
  }
}
