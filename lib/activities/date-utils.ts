import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { es } from 'date-fns/locale';

export type CalendarViewMode = 'day' | 'week' | 'month';

export function getVisibleRange(anchor: Date, mode: CalendarViewMode): { start: Date; end: Date } {
  if (mode === 'day') {
    return { start: anchor, end: anchor };
  }
  if (mode === 'week') {
    return { start: startOfWeek(anchor, { weekStartsOn: 1 }), end: endOfWeek(anchor, { weekStartsOn: 1 }) };
  }
  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);
  return {
    start: startOfWeek(monthStart, { weekStartsOn: 1 }),
    end: endOfWeek(monthEnd, { weekStartsOn: 1 }),
  };
}

export function navigateAnchor(anchor: Date, mode: CalendarViewMode, direction: 1 | -1): Date {
  if (mode === 'day') return addDays(anchor, direction);
  if (mode === 'week') return addWeeks(anchor, direction);
  return addMonths(anchor, direction);
}

export function buildMonthGrid(anchor: Date): Date[] {
  const { start, end } = getVisibleRange(anchor, 'month');
  const days: Date[] = [];
  let cursor = start;
  while (cursor <= end) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

export function buildWeekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export { isSameDay, isSameMonth };

export const HOUR_RANGE = Array.from({ length: 15 }, (_, i) => i + 6); // 06:00 - 20:00

export function formatDayLabel(date: Date): string {
  return format(date, "EEEE d 'de' MMMM", { locale: es });
}

export function formatShortDay(date: Date): string {
  return format(date, 'EEE d', { locale: es });
}

export function formatMonthLabel(date: Date): string {
  return format(date, "MMMM 'de' yyyy", { locale: es });
}

export function formatHourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

export function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
