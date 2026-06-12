import prisma from "~/lib/prisma";

export type AwardedBadge = {
  key: string;
  label: string;
  icon: string;
};

/**
 * Evaluate and persist any newly-earned badges for a user (read existing →
 * diff → insert). Shared by chore and school-item completion. Returns the
 * fresh stats so callers can build their celebration payload without a
 * second computeUserStats pass.
 */
export async function awardNewBadges(userId: string, localDate: string): Promise<{
  newBadges: AwardedBadge[];
  stats: UserStats;
}> {
  const [completions, adjustments, badges, existingBadges] = await Promise.all([
    getCompletionEvents(userId),
    getAdjustmentEvents(userId),
    getBadges(),
    prisma.userBadge.findMany({ where: { userId }, select: { badgeKey: true } }),
  ]);
  const stats = statsFromEvents(completions, adjustments, localDate);
  // Badges see completion-only values: manual deductions can't strip badge
  // progress and manual bonuses can't trigger completion-flavored badges.
  // The raw completion events feed the time/difficulty rules (Early Bird,
  // rolling average, …) that aggregates can't express.
  const earnedBadges = badges.filter(b => badgeEarned(b, {
    totalCompletions: stats.totalCompletions,
    maxPointsInADay: stats.maxPointsInADay,
    streak: stats.streak,
    pointsTotal: stats.pointsTotalRaw,
  }, userId, completions));
  const have = new Set(existingBadges.map(b => b.badgeKey));
  const newBadges = earnedBadges.filter(b => !have.has(b.key));
  if (newBadges.length) {
    await prisma.userBadge.createMany({
      data: newBadges.map(b => ({ userId, badgeKey: b.key })),
      skipDuplicates: true,
    });
  }
  return {
    newBadges: newBadges.map(b => ({ key: b.key, label: b.name, icon: b.icon })),
    stats,
  };
}
