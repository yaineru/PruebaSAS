import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isGoogleConfigured } from "@/lib/google/env";
import { decryptToken, encryptToken } from "@/lib/google/token-crypto";
import { refreshAccessToken } from "@/lib/google/oauth-client";

type ActivityForSync = {
  title: string;
  description?: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  location?: string | null;
  googleEventId?: string | null;
};

type GoogleCalendarConnectionRow = {
  id: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  token_expiry: string;
};

async function getConnectionForUser(ownerUserId: string): Promise<GoogleCalendarConnectionRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("google_calendar_connections")
    .select("id, access_token_encrypted, refresh_token_encrypted, token_expiry")
    .eq("user_id", ownerUserId)
    .eq("sync_enabled", true)
    .maybeSingle();
  return data;
}

async function getValidAccessToken(connection: GoogleCalendarConnectionRow): Promise<string | null> {
  const expiryMs = new Date(connection.token_expiry).getTime();
  if (Date.now() < expiryMs - 60_000) {
    return decryptToken(connection.access_token_encrypted);
  }
  try {
    const refreshToken = decryptToken(connection.refresh_token_encrypted);
    const refreshed = await refreshAccessToken(refreshToken);
    const supabase = await createClient();
    await supabase
      .from("google_calendar_connections")
      .update({
        access_token_encrypted: encryptToken(refreshed.accessToken),
        token_expiry: refreshed.expiryDate,
      })
      .eq("id", connection.id);
    return refreshed.accessToken;
  } catch (error) {
    console.warn("GOOGLE_TOKEN_REFRESH_FAILED", { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * Creates or updates the Google Calendar event mirroring this activity in
 * the owner's personal calendar. Returns the (possibly unchanged)
 * google_event_id to persist on the activity row. Never throws - a Google
 * API hiccup must never fail the underlying activity CRUD, matching this
 * codebase's existing fire-and-forget philosophy for non-critical side
 * effects (see trackAnalyticsEvent in lib/actions/notifications.ts).
 */
export async function syncActivityToGoogle(
  activity: ActivityForSync,
  ownerUserId: string | null
): Promise<string | null> {
  if (!isGoogleConfigured() || !ownerUserId) return activity.googleEventId ?? null;

  try {
    const connection = await getConnectionForUser(ownerUserId);
    if (!connection) return activity.googleEventId ?? null;

    const accessToken = await getValidAccessToken(connection);
    if (!accessToken) return activity.googleEventId ?? null;

    const body = {
      summary: activity.title,
      description: activity.description || undefined,
      location: activity.location || undefined,
      start: activity.allDay ? { date: activity.startAt.slice(0, 10) } : { dateTime: activity.startAt },
      end: activity.allDay ? { date: activity.endAt.slice(0, 10) } : { dateTime: activity.endAt },
    };

    const isUpdate = Boolean(activity.googleEventId);
    const url = isUpdate
      ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${activity.googleEventId}`
      : "https://www.googleapis.com/calendar/v3/calendars/primary/events";

    const response = await fetch(url, {
      method: isUpdate ? "PATCH" : "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.warn("GOOGLE_CALENDAR_SYNC_FAILED", { status: response.status, body: await response.text() });
      return activity.googleEventId ?? null;
    }

    const json = (await response.json()) as { id?: string };
    return json.id ?? activity.googleEventId ?? null;
  } catch (error) {
    console.warn("GOOGLE_CALENDAR_SYNC_ERROR", { error: error instanceof Error ? error.message : String(error) });
    return activity.googleEventId ?? null;
  }
}

export async function deleteActivityFromGoogle(googleEventId: string | null, ownerUserId: string | null): Promise<void> {
  if (!isGoogleConfigured() || !ownerUserId || !googleEventId) return;

  try {
    const connection = await getConnectionForUser(ownerUserId);
    if (!connection) return;

    const accessToken = await getValidAccessToken(connection);
    if (!accessToken) return;

    await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (error) {
    console.warn("GOOGLE_CALENDAR_DELETE_ERROR", { error: error instanceof Error ? error.message : String(error) });
  }
}
