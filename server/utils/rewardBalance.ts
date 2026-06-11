import prisma from "~/lib/prisma";

export type RewardBalance = {
  userId: string;
  earned: number; // completion points + manual adjustments (deductions/bonuses)
  approvedSpent: number; // sum of APPROVED redemption costs
  pendingSpent: number; // sum of PENDING redemption costs (advisory hold)
  available: number; // max(0, earned - approved - pending) — for display + soft checks
};

/**
 * Derive a user's reward-points balance (never a stored counter). `earned` is
 * NOT monotonic — uncompleting/deleting a chore or a parent deduction reduces
 * it — so `available` here is advisory (display + the soft request-time
 * check); the hard invariant (approved spend <= earned) is enforced at
 * approve time and inherits adjustments automatically.
 */
export async function computeRewardBalance(userId: string): Promise<RewardBalance> {
  const [choreAgg, schoolAgg, adjustAgg, approvedAgg, pendingAgg] = await Promise.all([
    prisma.choreCompletion.aggregate({ where: { userId }, _sum: { points: true } }),
    prisma.schoolItemCompletion.aggregate({ where: { userId }, _sum: { points: true } }),
    prisma.pointAdjustment.aggregate({ where: { userId }, _sum: { delta: true } }),
    prisma.redemption.aggregate({ where: { userId, status: "APPROVED" }, _sum: { pointsCost: true } }),
    prisma.redemption.aggregate({ where: { userId, status: "PENDING" }, _sum: { pointsCost: true } }),
  ]);

  const earned = (choreAgg._sum.points ?? 0) + (schoolAgg._sum.points ?? 0) + (adjustAgg._sum.delta ?? 0);
  const approvedSpent = approvedAgg._sum.pointsCost ?? 0;
  const pendingSpent = pendingAgg._sum.pointsCost ?? 0;
  const available = Math.max(0, earned - approvedSpent - pendingSpent);

  return { userId, earned, approvedSpent, pendingSpent, available };
}

/**
 * Balances for MANY users in five grouped queries total (instead of five per
 * user) — the balances endpoint renders on every rewards-page load.
 */
export async function computeAllRewardBalances(userIds: string[]): Promise<RewardBalance[]> {
  const where = { userId: { in: userIds } };
  const [choreSums, schoolSums, adjustSums, approvedSums, pendingSums] = await Promise.all([
    prisma.choreCompletion.groupBy({ by: ["userId"], where, _sum: { points: true } }),
    prisma.schoolItemCompletion.groupBy({ by: ["userId"], where, _sum: { points: true } }),
    prisma.pointAdjustment.groupBy({ by: ["userId"], where, _sum: { delta: true } }),
    prisma.redemption.groupBy({ by: ["userId"], where: { ...where, status: "APPROVED" }, _sum: { pointsCost: true } }),
    prisma.redemption.groupBy({ by: ["userId"], where: { ...where, status: "PENDING" }, _sum: { pointsCost: true } }),
  ]);

  const chore = new Map(choreSums.map(r => [r.userId, r._sum.points ?? 0]));
  const school = new Map(schoolSums.map(r => [r.userId, r._sum.points ?? 0]));
  const adjust = new Map(adjustSums.map(r => [r.userId, r._sum.delta ?? 0]));
  const approved = new Map(approvedSums.map(r => [r.userId, r._sum.pointsCost ?? 0]));
  const pending = new Map(pendingSums.map(r => [r.userId, r._sum.pointsCost ?? 0]));

  return userIds.map((userId) => {
    const earned = (chore.get(userId) ?? 0) + (school.get(userId) ?? 0) + (adjust.get(userId) ?? 0);
    const approvedSpent = approved.get(userId) ?? 0;
    const pendingSpent = pending.get(userId) ?? 0;
    return { userId, earned, approvedSpent, pendingSpent, available: Math.max(0, earned - approvedSpent - pendingSpent) };
  });
}
