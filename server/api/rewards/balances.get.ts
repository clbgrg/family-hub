import prisma from "~/lib/prisma";

/** Per-user reward-points balances (for the store header + the admin queue). */
export default defineEventHandler(async (event) => {
  await requireUserSession(event);

  const users = await prisma.user.findMany({ select: { id: true } });
  return Promise.all(users.map(u => computeRewardBalance(u.id)));
});
