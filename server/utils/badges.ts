import type { Badge } from "@prisma/client";

import prisma from "~/lib/prisma";

export interface BadgeStats {
  totalCompletions: number;
  maxPointsInADay: number;
  streak: number;
  pointsTotal: number; // lifetime earned (NOT the rewards spendable balance)
}

// Seeded idempotently (by unique key) so a fresh OR an upgraded family gets
// sensible badges; all are admin-editable afterward.
const DEFAULT_BADGES = [
  { key: "FIRST_CHORE", name: "First Chore", icon: "i-lucide-sparkles", description: "Completed your first chore", ruleType: "TOTAL_COMPLETIONS" as const, threshold: 1, order: 1 },
  { key: "CLEAN_MACHINE", name: "Clean Machine", icon: "i-lucide-award", description: "Completed 30 chores", ruleType: "TOTAL_COMPLETIONS" as const, threshold: 30, order: 2 },
  { key: "ALL_STAR", name: "All-Star", icon: "i-lucide-star", description: "Earned 100+ points in one day", ruleType: "POINTS_IN_DAY" as const, threshold: 100, order: 3 },
  { key: "HOT_STREAK", name: "Hot Streak", icon: "i-lucide-flame", description: "7-day chore streak", ruleType: "STREAK" as const, threshold: 7, order: 4 },
];

export async function ensureDefaultBadges(): Promise<void> {
  await prisma.badge.createMany({ data: DEFAULT_BADGES, skipDuplicates: true });
}

export async function getBadges(): Promise<Badge[]> {
  await ensureDefaultBadges();
  return prisma.badge.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] });
}

export function badgeEarned(badge: Badge, stats: BadgeStats): boolean {
  switch (badge.ruleType) {
    case "STREAK": return stats.streak >= badge.threshold;
    case "TOTAL_POINTS": return stats.pointsTotal >= badge.threshold;
    case "TOTAL_COMPLETIONS": return stats.totalCompletions >= badge.threshold;
    case "POINTS_IN_DAY": return stats.maxPointsInADay >= badge.threshold;
    default: return false;
  }
}

/** Badge definitions the user currently qualifies for. */
export async function evaluateEarnedBadges(stats: BadgeStats): Promise<Badge[]> {
  const badges = await getBadges();
  return badges.filter(b => badgeEarned(b, stats));
}
