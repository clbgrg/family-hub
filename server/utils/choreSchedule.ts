// Shared chore scheduling logic — used by the board (chores/index.get) and the
// all-done celebration check (chores/[id]/complete.post) so they never drift.

/** Weekday 0=Sun..6=Sat of a calendar date, UTC-parsed so it's TZ-independent. */
export function weekdayOf(localDate: string): number {
  return new Date(`${localDate}T00:00:00Z`).getUTCDay();
}

export type ChoreDayInput = {
  recurrence: "ONCE" | "DAILY" | "WEEKLY";
  daysOfWeek: number[];
  doneEver: boolean;
  doneToday: boolean;
  localDate: string;
};

/**
 * For a chore on a given local date: is it part of "today's set" (dueToday),
 * and is it done? ONCE chores stay in today's set only while still pending, or
 * if they were completed today; DAILY/WEEKLY follow their schedule.
 */
export function choreDayStatus(input: ChoreDayInput): { dueToday: boolean; done: boolean } {
  const { recurrence, daysOfWeek, doneEver, doneToday, localDate } = input;

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
