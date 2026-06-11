import prisma from "~/lib/prisma";

import type { PointEvent } from "./points";

export type UserStats = {
  // Net values (completions + manual adjustments) — what gets DISPLAYED.
  pointsTotal: number;
  pointsToday: number;
  pointsWeek: number;
  // Completion-only values — what feeds BADGES (a deduction can never strip
  // badge progress; a manual bonus can never trigger completion badges).
  pointsTotalRaw: number;
  streak: number;
  totalCompletions: number;
  maxPointsInADay: number;
  adjustmentsTotal: number;
};

/**
 * Derive a user's gamification stats from their completion history plus
 * manual point adjustments (no stored counters). `today` is the client's
 * local date (YYYY-MM-DD); the week is the Sunday-started week containing it.
 */
export async function computeUserStats(userId: string, today: string): Promise<UserStats> {
  const [completions, adjustments] = await Promise.all([
    getCompletionEvents(userId),
    getAdjustmentEvents(userId),
  ]);
  return statsFromEvents(completions, adjustments, today);
}

/**
 * Stats for MANY users in three batched queries (instead of three per user) —
 * the leaderboard/stats endpoint is the hottest read in the app, polled by the
 * dashboard, the chore board, and rewards at once.
 */
export async function computeAllUserStats(userIds: string[], today: string): Promise<Map<string, UserStats>> {
  const where = { userId: { in: userIds } };
  const [choreCompletions, schoolCompletions, adjustments] = await Promise.all([
    prisma.choreCompletion.findMany({ where, select: { userId: true, localDate: true, points: true } }),
    prisma.schoolItemCompletion.findMany({ where, select: { userId: true, localDate: true, points: true } }),
    prisma.pointAdjustment.findMany({ where, select: { userId: true, localDate: true, delta: true } }),
  ]);

  const completionsByUser = new Map<string, PointEvent[]>();
  for (const c of [...choreCompletions, ...schoolCompletions]) {
    const arr = completionsByUser.get(c.userId) ?? [];
    arr.push({ localDate: c.localDate, points: c.points });
    completionsByUser.set(c.userId, arr);
  }
  const adjustmentsByUser = new Map<string, PointEvent[]>();
  for (const a of adjustments) {
    const arr = adjustmentsByUser.get(a.userId) ?? [];
    arr.push({ localDate: a.localDate, points: a.delta });
    adjustmentsByUser.set(a.userId, arr);
  }

  return new Map(userIds.map(id => [
    id,
    statsFromEvents(completionsByUser.get(id) ?? [], adjustmentsByUser.get(id) ?? [], today),
  ]));
}

/** Pure stats derivation from already-fetched point events (see computeUserStats). */
export function statsFromEvents(completions: PointEvent[], adjustments: PointEvent[], today: string): UserStats {
  let pointsTotalRaw = 0;
  let pointsToday = 0;
  const pointsByDate = new Map<string, number>();
  for (const c of completions) {
    pointsTotalRaw += c.points;
    if (c.localDate === today)
      pointsToday += c.points;
    pointsByDate.set(c.localDate, (pointsByDate.get(c.localDate) ?? 0) + c.points);
  }

  const totalCompletions = completions.length;
  const maxPointsInADay = pointsByDate.size ? Math.max(...pointsByDate.values()) : 0;

  // Weekly points: Sunday-started week containing `today`.
  const start = weekStart(today);
  const end = addDays(start, 6);
  let pointsWeek = 0;
  for (const c of completions) {
    if (c.localDate >= start && c.localDate <= end)
      pointsWeek += c.points;
  }

  // Streak: consecutive days with >=1 completion, ending today (or yesterday,
  // so a streak isn't "broken" before today's chores are done). Adjustments
  // never count toward (or against) the streak.
  const days = new Set(completions.map(c => c.localDate));
  let cursor = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }

  // Fold adjustments into the displayed totals only, bucketed by localDate.
  let adjustmentsTotal = 0;
  for (const a of adjustments) {
    adjustmentsTotal += a.points;
    if (a.localDate === today)
      pointsToday += a.points;
    if (a.localDate >= start && a.localDate <= end)
      pointsWeek += a.points;
  }

  return {
    pointsTotal: pointsTotalRaw + adjustmentsTotal,
    pointsToday,
    pointsWeek,
    pointsTotalRaw,
    streak,
    totalCompletions,
    maxPointsInADay,
    adjustmentsTotal,
  };
}

/**
 * Has the user finished all their chores for `localDate`? True only when there
 * is at least one chore in today's set and every one is done (not vacuously
 * true for a user with nothing due). Uses the shared choreDayStatus predicate.
 */
export async function isAllDoneToday(userId: string, localDate: string): Promise<boolean> {
  const chores = await prisma.chore.findMany({
    where: { active: true, assignments: { some: { userId } } },
    include: {
      // Only THIS user's TODAY completions — assignees complete independently,
      // and doneEver (which needs history) only matters for ONCE chores below.
      completions: { where: { userId, localDate }, select: { localDate: true } },
    },
  });

  // doneEver for ONCE chores, without dragging full completion history along.
  const onceIds = chores.filter(c => c.recurrence === "ONCE").map(c => c.id);
  const everDone = onceIds.length
    ? await prisma.choreCompletion.findMany({
        where: { userId, choreId: { in: onceIds } },
        select: { choreId: true },
      })
    : [];
  const everDoneOnce = new Set(everDone.map(e => e.choreId));

  const todays = chores
    .map(c => choreDayStatus({
      recurrence: c.recurrence,
      daysOfWeek: c.daysOfWeek,
      doneEver: c.completions.length > 0 || everDoneOnce.has(c.id),
      doneToday: c.completions.length > 0,
      localDate,
    }))
    .filter(s => s.dueToday);

  return todays.length >= 1 && todays.every(s => s.done);
}
