import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateIcsFeed } from "@/lib/activities/ics";

// Public, unauthenticated by design (an .ics feed URL is a bearer-token
// capability link, exactly like Google Calendar's own "secret address in
// iCal format") - security comes entirely from the token being an
// unguessable 24-byte random value (calendar_share_links.ics_token), never
// from session/RLS. Looked up with the admin client because there is no
// user session on this route; every subsequent query is manually scoped to
// that single row's user_id/company_id, never to a client-supplied id.
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: share } = await admin
    .from("calendar_share_links")
    .select("user_id, company_id, ics_enabled")
    .eq("ics_token", token)
    .maybeSingle();

  if (!share || !share.ics_enabled) {
    return NextResponse.json({ error: "Enlace no encontrado o deshabilitado." }, { status: 404 });
  }

  const { data: user } = await admin.from("users").select("full_name").eq("id", share.user_id).maybeSingle();

  const { data: activities } = await admin
    .from("activities")
    .select("id, title, description, location, start_at, end_at, all_day, status, updated_at")
    .eq("company_id", share.company_id)
    .eq("owner_user_id", share.user_id)
    .is("deleted_at", null)
    .order("start_at", { ascending: true })
    .limit(1000);

  const ics = generateIcsFeed(`Agenda de ${user?.full_name ?? "EmpresaOS"}`, (activities ?? []).map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
    location: a.location,
    startAt: a.start_at,
    endAt: a.end_at,
    allDay: a.all_day,
    status: a.status,
    updatedAt: a.updated_at
  })));

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "inline; filename=agenda.ics",
      "Cache-Control": "no-store"
    }
  });
}
