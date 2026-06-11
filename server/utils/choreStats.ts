import prisma from "~/lib/prisma";

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
      // Only THIS user's completions count — assignees complete independently.
      completions: { where: { userId }, select: { localDate: true } },
    },
  });

  const todays = chores
    .map(c => choreDayStatus({
      recurrence: c.recurrence,
      daysOfWeek: c.daysOfWeek,
      doneEver: c.completions.length > 0,
      doneToday: c.completions.some(x => x.localDate === localDate),
      localDate,
    }))
    .filter(s => s.dueToday);

  return todays.length >= 1 && todays.every(s => s.done);
}
