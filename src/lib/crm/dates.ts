/**
 * Follow-up dates are calendar days, not instants. They are stored at 12:00
 * UTC so the day never shifts in any timezone between UTC-11 and UTC+11, and
 * they are always read back with UTC getters.
 */

const followUpFmt = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const DATE_INPUT = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "2026-10-30" → Date at 2026-10-30T12:00:00Z. Null for empty or invalid input. */
export function parseDateInput(value: string | null | undefined): Date | null {
  const m = value?.trim().match(DATE_INPUT);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d, 12));
  // Reject overflow such as 2026-02-31.
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date;
}

/** Value for <input type="date">. */
export function toDateInputValue(d: Date | string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

/** Calendar day of a stored follow-up date. */
export function followUpDayKey(d: Date | string): string {
  return toDateInputValue(d);
}

/** Today's calendar day where the server runs (the user's machine in local use). */
export function todayKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Whole days from today to the follow-up day (negative = overdue). */
export function daysUntil(d: Date | string, now = new Date()): number {
  const target = Date.parse(`${followUpDayKey(d)}T00:00:00Z`);
  const today = Date.parse(`${todayKey(now)}T00:00:00Z`);
  return Math.round((target - today) / 86_400_000);
}

export type FollowUpState = "overdue" | "today" | "soon" | "later";

export function followUpState(d: Date | string | null | undefined, now = new Date()): FollowUpState | null {
  if (!d) return null;
  const days = daysUntil(d, now);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 7) return "soon";
  return "later";
}

export function formatFollowUp(d: Date | string | null | undefined): string {
  return d ? followUpFmt.format(new Date(d)) : "—";
}

/** "Vencido hace 3 días", "Hoy", "Mañana", "En 5 días", or the date. */
export function describeFollowUp(d: Date | string, now = new Date()): string {
  const days = daysUntil(d, now);
  if (days < -1) return `Vencido hace ${-days} días`;
  if (days === -1) return "Vencido ayer";
  if (days === 0) return "Hoy";
  if (days === 1) return "Mañana";
  if (days <= 7) return `En ${days} días`;
  return formatFollowUp(d);
}
