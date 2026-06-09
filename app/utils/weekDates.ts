// Client-local week/date helpers (YYYY-MM-DD). Dates are calendar days, parsed
// in UTC so day arithmetic is timezone-stable; "today" uses the client's local
// date (the meal planner is a client-only, client-date view).

export function isoToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDaysIso(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** The Sunday that starts the week containing `date`. */
export function weekStartSunday(date: string): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDaysIso(date, -dow);
}

/** The Monday that starts the (ISO) week containing `date`. */
export function weekStartMonday(date: string): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0=Sun..6=Sat
  return addDaysIso(date, dow === 0 ? -6 : 1 - dow);
}

/** Short label like "Mon 6/8" for a YYYY-MM-DD date. */
export function dayLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "numeric",
    day: "numeric",
    timeZone: "UTC",
  });
}
