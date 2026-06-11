import prisma from "~/lib/prisma";

/**
 * Per-user gamification stats for a client-local date: points (total/today/
 * week), streak, and earned badge keys. Drives the leaderboard and per-member
 * badges/streak on the board.
 */
export default defineEventHandler(async (event) => {
  await requireUserSession(event);

  const date = String(getQuery(event).date ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw createError({ statusCode: 400, statusMessage: "date (YYYY-MM-DD) query param required" });
  }

  const users = await prisma.user.findMany({ select: { id: true } });
  const allUserBadges = await prisma.userBadge.findMany({ select: { userId: true, badgeKey: true, earnedAt: true } });
  const definitions = new Map((await getBadges()).map(b => [b.key, b]));

  const badgesByUser = new Map<string, { badgeKey: string; earnedAt: Date }[]>();
  for (const b of allUserBadges) {
    const arr = badgesByUser.get(b.userId) ?? [];
    arr.push(b);
    badgesByUser.set(b.userId, arr);
  }

  const result = [];
  for (const u of users) {
    const stats = await computeUserStats(u.id, date);
    const badges = (badgesByUser.get(u.id) ?? []).map(({ badgeKey: key, earnedAt }) => {
      const def = definitions.get(key);
      return {
        key,
        label: def?.name ?? key,
        icon: def?.icon ?? "i-lucide-award",
        description: def?.description ?? null,
        earnedAt,
      };
    });
    result.push({ userId: u.id, ...stats, badges });
  }
  return result;
});
