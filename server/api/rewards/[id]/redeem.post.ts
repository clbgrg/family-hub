import prisma from "~/lib/prisma";

/**
 * Request to redeem a reward. Any member can redeem for THEMSELVES (spends
 * their own points). The available-points check here is advisory (so a kid
 * can't obviously over-request) — the hard invariant is enforced at approve
 * time, since `earned` can drop afterward. Creates a PENDING request.
 */
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);

  const rewardId = getRouterParam(event, "id");
  if (!rewardId) {
    throw createError({ statusCode: 400, statusMessage: "reward id is required" });
  }

  const reward = await prisma.reward.findUnique({ where: { id: rewardId } });
  if (!reward || !reward.active) {
    throw createError({ statusCode: 404, statusMessage: "Reward not found" });
  }

  const userId = session.user.id;
  const balance = await computeRewardBalance(userId);
  if (balance.available < reward.pointsCost) {
    throw createError({ statusCode: 400, statusMessage: "Not enough points available" });
  }

  return prisma.redemption.create({
    data: {
      rewardId,
      userId,
      rewardName: reward.name,
      pointsCost: reward.pointsCost,
      status: "PENDING",
    },
  });
});
