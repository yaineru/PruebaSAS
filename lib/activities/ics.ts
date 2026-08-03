import "server-only";

type IcsActivity = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  status: "SCHEDULED" | "CANCELLED" | "DONE";
  updatedAt: string;
  sequence?: number;
};

function foldLine(line: string): string {
  // RFC 5545 §3.1: lines longer than 75 octets must be folded with a CRLF +
  // single leading space, or Outlook/Apple Calendar can silently truncate
  // long SUMMARY/DESCRIPTION values.
  if (line.length <= 75) return line;
  let result = "";
  let remaining = line;
  while (remaining.length > 74) {
    result += remaining.slice(0, 74) + "\r\n ";
    remaining = remaining.slice(74);
  }
  return result + remaining;
}

function escapeIcsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function toIcsDate(iso: string, allDay: boolean): string {
  const date = new Date(iso);
  if (allDay) {
    return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
  }
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

/**
 * Generates an RFC 5545-compliant calendar feed. Uses plain UTC (trailing
 * "Z") timestamps rather than a VTIMEZONE block - every mainstream client
 * (Google Calendar, Apple Calendar, Outlook/365, Thunderbird, the stock
 * Android/iOS calendar apps) displays a UTC-suffixed DTSTART/DTEND correctly
 * converted to the viewer's local timezone, which covers the interoperability
 * requirement without the added complexity/failure surface of embedding a
 * full IANA-to-VTIMEZONE table.
 */
export function generateIcsFeed(calendarName: string, activities: IcsActivity[]): string {
  const now = toIcsDate(new Date().toISOString(), false);

  const events = activities.map((activity) => {
    const isAllDay = activity.allDay;
    const dtStart = isAllDay ? `DTSTART;VALUE=DATE:${toIcsDate(activity.startAt, true)}` : `DTSTART:${toIcsDate(activity.startAt, false)}`;
    const dtEnd = isAllDay ? `DTEND;VALUE=DATE:${toIcsDate(activity.endAt, true)}` : `DTEND:${toIcsDate(activity.endAt, false)}`;
    const status = activity.status === "CANCELLED" ? "CANCELLED" : activity.status === "DONE" ? "CONFIRMED" : "CONFIRMED";

    const lines = [
      "BEGIN:VEVENT",
      `UID:${activity.id}@empresaos`,
      `DTSTAMP:${now}`,
      dtStart,
      dtEnd,
      `SUMMARY:${escapeIcsText(activity.title)}`,
      activity.description ? `DESCRIPTION:${escapeIcsText(activity.description)}` : null,
      activity.location ? `LOCATION:${escapeIcsText(activity.location)}` : null,
      `STATUS:${status}`,
      `SEQUENCE:${activity.sequence ?? 0}`,
      `LAST-MODIFIED:${toIcsDate(activity.updatedAt, false)}`,
      "END:VEVENT"
    ].filter((line): line is string => Boolean(line));

    return lines.map(foldLine).join("\r\n");
  });

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EmpresaOS//Agenda//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    ...events,
    "END:VCALENDAR"
  ].join("\r\n");
}
