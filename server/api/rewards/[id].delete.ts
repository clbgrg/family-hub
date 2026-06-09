import prisma from "~/lib/prisma";

/**
 * Delete a reward. Admin only. Its redemptions are kept (rewardId is SetNull;
 * rewardName/pointsCost are snapshotted), so history and any already-approved
 * spend are preserved.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "reward id is required" });
  }

  try {
    await prisma.reward.delete({ where: { id } });
    return { ok: true };
  }
  catch (error: any) {
    if (error?.code === "P2025") {
      throw createError({ statusCode: 404, statusMessage: "Reward not found" });
    }
    throw error;
  }
});
