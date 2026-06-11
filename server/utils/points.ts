import prisma from "~/lib/prisma";

export type PointEvent = {
  localDate: string;
  points: number;
};

/**
 * All point-earning COMPLETION events for a user (chore + school item
 * completions, one pool). These drive streaks, completion counts, and badge
 * progress — adjustments deliberately do NOT.
 */
export async function getCompletionEvents(userId: string): Promise<PointEvent[]> {
  const [choreCompletions, schoolCompletions] = await Promise.all([
    prisma.choreCompletion.findMany({
      where: { userId },
      select: { localDate: true, points: true },
    }),
    prisma.schoolItemCompletion.findMany({
      where: { userId },
      select: { localDate: true, points: true },
    }),
  ]);
  return [...choreCompletions, ...schoolCompletions];
}

/**
 * Manual adjustments (parent deductions/bonuses) as dated point events.
 * Folded into displayed totals and the spendable balance only.
 */
export async function getAdjustmentEvents(userId: string): Promise<PointEvent[]> {
  const adjustments = await prisma.pointAdjustment.findMany({
    where: { userId },
    select: { localDate: true, delta: true },
  });
  return adjustments.map(a => ({ localDate: a.localDate, points: a.delta }));
}
