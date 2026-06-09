import prisma from "~/lib/prisma";

/**
 * Approve a redemption. Admin only. This is the HARD gate on the points
 * economy: `earned` may have dropped since the request (a chore was uncompleted
 * or deleted), so re-check that total approved spend stays within earned.
 * Only acts on a PENDING request (a terminal one can't be flipped).
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "redemption id is required" });
  }

  const redemption = await prisma.redemption.findUnique({ where: { id } });
  if (!redemption) {
    throw createError({ statusCode: 404, statusMessage: "Redemption not found" });
  }
  if (redemption.status !== "PENDING") {
    throw createError({ statusCode: 409, statusMessage: "This request was already decided" });
  }

  const balance = await computeRewardBalance(redemption.userId);
  if (balance.approvedSpent + redemption.pointsCost > balance.earned) {
    throw createError({ statusCode: 409, statusMessage: "Not enough points anymore" });
  }

  return prisma.redemption.update({
    where: { id },
    data: { status: "APPROVED", decidedAt: new Date() },
  });
});
