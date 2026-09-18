export const TIMEZONE = "Europe/Madrid";
export function today(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export const currentMonth = (now = new Date()) => today(now).slice(0, 7);
export function addDays(date: string, days: number) {
  const d = new Date(`${date.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}
export function monthEnd(month: string) {
  return addDays(`${shiftMonth(month, 1)}-01`, -1);
}
export const monthLabel = (month: string, short = false) =>
  new Intl.DateTimeFormat("es-ES", {
    month: short ? "short" : "long",
    ...(short ? {} : { year: "numeric" }),
    timeZone: "UTC",
  }).format(new Date(`${month}-15T12:00:00Z`));
export const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    timeZone: TIMEZONE,
  }).format(new Date(date.length === 10 ? `${date}T12:00:00Z` : date));
