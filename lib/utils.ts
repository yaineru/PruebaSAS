import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";

  // Date-only values ("YYYY-MM-DD", from Postgres `date` columns like
  // due_date/expires_at) are a calendar day, not a moment in time. new
  // Date("2027-03-31") parses that as UTC midnight, so Intl.DateTimeFormat
  // then renders it in the local timezone - in any zone behind UTC (e.g.
  // Colombia, UTC-5) the displayed day silently rolls back by one. Building
  // the date from its parts keeps it anchored to the intended calendar day.
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium"
  }).format(date);
}

// EmpresaOS is currently single-region (Colombia). Server-rendered timestamps
// must pin timeZone explicitly: Vercel functions default to UTC, so an
// unqualified Intl.DateTimeFormat/toLocaleString on the server renders in UTC
// instead of the user's Colombia local time - client components don't have
// this problem since the browser's own timezone is implicit there.
const BOGOTA_TIME_ZONE = "America/Bogota";

export function formatDateTime(value?: string | Date | null) {
  if (!value) return "Sin fecha";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "Sin fecha";

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: BOGOTA_TIME_ZONE
  }).format(date);
}

export function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: BOGOTA_TIME_ZONE
  }).format(date);
}

export function formatCurrency(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(value);
}

export function formatBytes(value?: number | null) {
  if (!value || Number.isNaN(value) || value <= 0) return "-";

  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
