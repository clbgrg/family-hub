import prisma from "~/lib/prisma";

export interface RewardBalance {
  userId: string;
  earned: number; // sum of chore-completion points
  approvedSpent: number; // sum of APPROVED redemption costs
  pendingSpent: number; // sum of PENDING redemption costs (advisory hold)
  available: number; // max(0, earned - approved - pending) — for display + soft checks
}

/**
 * Derive a user's reward-points balance (never a stored counter). `earned` is
 * NOT monotonic — uncompleting/deleting a chore reduces it — so `available`
 * here is advisory (display + the soft request-time check); the hard invariant
 * (approved spend <= earned) is enforced at approve time.
 */
export async function computeRewardBalance(userId: string): Promise<RewardBalance> {
  const [earnedAgg, approvedAgg, pendingAgg] = await Promise.all([
    prisma.choreCompletion.aggregate({ where: { userId }, _sum: { points: true } }),
    prisma.redemption.aggregate({ where: { userId, status: "APPROVED" }, _sum: { pointsCost: true } }),
    prisma.redemption.aggregate({ where: { userId, status: "PENDING" }, _sum: { pointsCost: true } }),
  ]);

  const earned = earnedAgg._sum.points ?? 0;
  const approvedSpent = approvedAgg._sum.pointsCost ?? 0;
  const pendingSpent = pendingAgg._sum.pointsCost ?? 0;
  const available = Math.max(0, earned - approvedSpent - pendingSpent);

  return { userId, earned, approvedSpent, pendingSpent, available };
}
