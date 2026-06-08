import prisma from "~/lib/prisma";

/** Per-user total points earned (sum of all chore completions). */
export default defineEventHandler(async (event) => {
  await requireUserSession(event);

  const grouped = await prisma.choreCompletion.groupBy({
    by: ["userId"],
    _sum: { points: true },
  });

  return grouped.map(g => ({ userId: g.userId, points: g._sum.points ?? 0 }));
});
