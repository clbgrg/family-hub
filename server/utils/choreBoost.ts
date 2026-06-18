// Automatic point-boosting for neglected recurring chores. A chore that keeps
// going undone past a short grace period accrues an escalating, capped bonus on
// top of its base points — surfaced on the board and frozen into the completion
// when it's finally done, after which the neglect resets and the bonus vanishes.
// Fully derived from completion history + schedule: no stored state, no cron.

import type { ChoreRecurrence, ChoreWindow } from "./choreSchedule";

import { addDays, choreActiveOn, daysSinceEpoch, weekdayOf } from "./choreSchedule";

/** Missed due-days that pass before any bonus kicks in (a short grace period). */
export const BOOST_THRESHOLD = 2;
/** Extra points added per missed due-day past the threshold. */
export const BOOST_STEP = 2;
/** Hard ceiling on the bonus, so neglect can never mint unlimited points. */
export const BOOST_CAP = 10;
/** How far the neglect walk looks back — past this the bonus is capped anyway. */
const MAX_LOOKBACK_DAYS = 60;

export type BoostChore = ChoreWindow & {
  recurrence: ChoreRecurrence;
  daysOfWeek: number[];
  /** Day the chore was created (YYYY-MM-DD); it can't be neglected before it existed. */
  createdAt?: string | null;
};

/**
 * Is the chore due (scheduled AND active) on a given local date? Recurring only
 * — ONCE chores never accrue a boost. `choreActiveOn` makes paused / out-of-
 * window days count as "not due", so a vacation pause correctly suppresses it.
 */
function dueOn(chore: BoostChore, localDate: string): boolean {
  if (!choreActiveOn(localDate, chore))
    return false;
  if (chore.recurrence === "DAILY")
    return true;
  if (chore.recurrence === "WEEKLY")
    return chore.daysOfWeek.includes(weekdayOf(localDate));
  return false;
}

/**
 * How many due-days the chore was missed strictly before `today`, walking back
 * to the day after its last completion (or a bounded lookback if never done).
 * ONCE chores always return 0. Completing the chore moves `lastCompletion` to
 * today, so the next call returns 0 — the boost resets itself.
 */
export function neglectStreak(chore: BoostChore, lastCompletion: string | null, today: string): number {
  if (chore.recurrence === "ONCE")
    return 0;

  const lookbackFloor = daysSinceEpoch(addDays(today, -MAX_LOOKBACK_DAYS));
  // A chore isn't "neglected" before it existed: don't count days on or before
  // its creation day (createdAt - 1), nor any day up to its last completion.
  const createdFloor = chore.createdAt ? daysSinceEpoch(chore.createdAt) - 1 : lookbackFloor;
  const lastEpoch = lastCompletion ? daysSinceEpoch(lastCompletion) : -Infinity;
  const stopAt = Math.max(lastEpoch, createdFloor, lookbackFloor);

  let count = 0;
  for (let d = addDays(today, -1); daysSinceEpoch(d) > stopAt; d = addDays(d, -1)) {
    if (dueOn(chore, d))
      count++;
  }
  return count;
}

/** Bonus points for a given neglect streak (0 below the threshold; capped). */
export function boostFor(streak: number): number {
  if (streak < BOOST_THRESHOLD)
    return 0;
  return Math.min(BOOST_STEP * (streak - BOOST_THRESHOLD + 1), BOOST_CAP);
}

/** The bonus a chore currently carries on `today`, given its last completion. */
export function computeBoost(chore: BoostChore, lastCompletion: string | null, today: string): number {
  return boostFor(neglectStreak(chore, lastCompletion, today));
}
