// Shared chore scheduling logic — used by the board (chores/index.get) and the
// all-done celebration check (chores/[id]/complete.post) so they never drift.

/** Weekday 0=Sun..6=Sat of a calendar date, UTC-parsed so it's TZ-independent. */
export function weekdayOf(localDate: string): number {
  return new Date(`${localDate}T00:00:00Z`).getUTCDay();
}

export type ChoreRecurrence = "ONCE" | "DAILY" | "WEEKLY";

export type ChoreWindow = {
  startDate?: string | null;
  endDate?: string | null;
  pausedUntil?: string | null;
};

export type ChoreDayInput = ChoreWindow & {
  recurrence: ChoreRecurrence;
  daysOfWeek: number[];
  doneEver: boolean;
  doneToday: boolean;
  localDate: string;
};

/**
 * Is the chore active on localDate? False before its start, after its end, or
 * while paused. Bounds are inclusive; YYYY-MM-DD strings compare lexically.
 */
export function choreActiveOn(localDate: string, window: ChoreWindow): boolean {
  if (window.startDate && localDate < window.startDate)
    return false;
  if (window.endDate && localDate > window.endDate)
    return false;
  if (window.pausedUntil && localDate < window.pausedUntil)
    return false;
  return true;
}

/**
 * For a chore on a given local date: is it part of "today's set" (dueToday),
 * and is it done? Out-of-window or paused chores are never due. ONCE chores
 * stay in today's set only while still pending, or if completed today;
 * DAILY/WEEKLY follow their schedule.
 */
export function choreDayStatus(input: ChoreDayInput): { dueToday: boolean; done: boolean } {
  const { recurrence, daysOfWeek, doneEver, doneToday, localDate } = input;

  if (!choreActiveOn(localDate, input)) {
    return { dueToday: false, done: recurrence === "ONCE" ? doneEver : doneToday };
  }

  if (recurrence === "ONCE") {
    return { dueToday: doneToday || !doneEver, done: doneEver };
  }

  const scheduled = recurrence === "DAILY" || daysOfWeek.includes(weekdayOf(localDate));
  return { dueToday: scheduled, done: doneToday };
}

/** Add (or subtract) whole days to a YYYY-MM-DD date, returning YYYY-MM-DD. */
export function addDays(localDate: string, delta: number): string {
  const d = new Date(`${localDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** The Sunday that starts the week containing localDate (YYYY-MM-DD). */
export function weekStart(localDate: string): string {
  return addDays(localDate, -weekdayOf(localDate));
}

/** Whole days from the Unix epoch to localDate (UTC-parsed, TZ-independent). */
export function daysSinceEpoch(localDate: string): number {
  return Math.floor(Date.parse(`${localDate}T00:00:00Z`) / 86_400_000);
}

/**
 * Which assignee is on duty for a rotating chore on localDate, as an index into
 * a stably-ordered assignee list. DAILY chores rotate each day; WEEKLY rotate
 * each (Sunday-started) week, so the same person owns it all week. Deterministic
 * and stateless — no cron or stored pointer.
 */
export function rotationIndex(recurrence: ChoreRecurrence, localDate: string, count: number): number {
  if (count <= 1)
    return 0;
  const period = recurrence === "WEEKLY"
    ? Math.floor(daysSinceEpoch(weekStart(localDate)) / 7)
    : daysSinceEpoch(localDate);
  return ((period % count) + count) % count;
}
