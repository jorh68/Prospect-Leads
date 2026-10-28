const dateFmt = new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const numberFmt = new Intl.NumberFormat("es-ES");
const relFmt = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

export function formatDate(d: Date | string | null | undefined): string {
  return d ? dateFmt.format(new Date(d)) : "—";
}

export function formatDateTime(d: Date | string | null | undefined): string {
  return d ? dateTimeFmt.format(new Date(d)) : "—";
}

export function formatNumber(n: number | null | undefined): string {
  return n == null ? "—" : numberFmt.format(n);
}

/** "hace 5 min", "ayer"… */
export function formatRelative(d: Date | string | null | undefined, now = new Date()): string {
  if (!d) return "—";
  const diff = (new Date(d).getTime() - now.getTime()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return "ahora";
  if (abs < 3600) return relFmt.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return relFmt.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return relFmt.format(Math.round(diff / 86400), "day");
  return formatDate(d);
}

export function formatRating(rating: number | null | undefined): string {
  return rating == null ? "—" : rating.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** URL without scheme and trailing slash, for display. */
export function displayUrl(url: string | null | undefined): string {
  if (!url) return "—";
  return url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
}

/** Readable phone: Spanish numbers as "+34 910 00 00 01", others grouped. */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  const es = phone.startsWith("+34") ? digits.slice(2) : digits.length === 9 ? digits : null;
  if (es && es.length === 9) {
    const local = `${es.slice(0, 3)} ${es.slice(3, 5)} ${es.slice(5, 7)} ${es.slice(7)}`;
    return phone.startsWith("+34") ? `+34 ${local}` : local;
  }
  return phone.startsWith("+") ? `+${digits.replace(/(\d{2,3})(?=(\d{3})+$)/g, "$1 ")}` : phone;
}
