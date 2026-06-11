import type { Badge } from "@prisma/client";

import prisma from "~/lib/prisma";

// Rule types live as a TS union now (the Prisma enum was dropped when badges
// moved to JSON conditions); writes are validated against this list.
export const BADGE_RULE_TYPES = ["STREAK", "TOTAL_POINTS", "TOTAL_COMPLETIONS", "POINTS_IN_DAY"] as const;
export type BadgeRuleType = (typeof BADGE_RULE_TYPES)[number];

export type BadgeCondition = {
  ruleType: BadgeRuleType;
  threshold: number;
};

export type BadgeStats = {
  totalCompletions: number;
  maxPointsInADay: number;
  streak: number;
  pointsTotal: number; // lifetime COMPLETION points (raw — adjustments excluded)
};

// Seeded idempotently (by unique key) so a fresh OR an upgraded family gets
// sensible badges; all are admin-editable afterward.
const DEFAULT_BADGES = [
  { key: "FIRST_CHORE", name: "First Chore", icon: "i-lucide-sparkles", description: "Completed your first chore", conditions: [{ ruleType: "TOTAL_COMPLETIONS", threshold: 1 }], order: 1 },
  { key: "CLEAN_MACHINE", name: "Clean Machine", icon: "i-lucide-award", description: "Completed 30 chores", conditions: [{ ruleType: "TOTAL_COMPLETIONS", threshold: 30 }], order: 2 },
  { key: "ALL_STAR", name: "All-Star", icon: "i-lucide-star", description: "Earned 100+ points in one day", conditions: [{ ruleType: "POINTS_IN_DAY", threshold: 100 }], order: 3 },
  { key: "HOT_STREAK", name: "Hot Streak", icon: "i-lucide-flame", description: "7-day streak", conditions: [{ ruleType: "STREAK", threshold: 7 }], order: 4 },
];

// Seed only into an EMPTY badges table, once per process. Seeding on every
// read (the old behavior) was a write on the hottest read path AND silently
// resurrected default badges an admin had deliberately deleted.
let defaultsChecked = false;

export async function ensureDefaultBadges(): Promise<void> {
  if (defaultsChecked)
    return;
  const existing = await prisma.badge.count();
  if (existing === 0) {
    await prisma.badge.createMany({ data: DEFAULT_BADGES, skipDuplicates: true });
  }
  defaultsChecked = true;
}

export async function getBadges(): Promise<Badge[]> {
  await ensureDefaultBadges();
  return prisma.badge.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] });
}

/** Parse a badge's JSON conditions, dropping anything malformed (fail closed). */
export function parseBadgeConditions(badge: Pick<Badge, "conditions">): BadgeCondition[] {
  const raw = badge.conditions;
  if (!Array.isArray(raw))
    return [];
  const out: BadgeCondition[] = [];
  for (const c of raw) {
    if (c && typeof c === "object" && !Array.isArray(c)) {
      const ruleType = (c as Record<string, unknown>).ruleType;
      const threshold = Number((c as Record<string, unknown>).threshold);
      if (BADGE_RULE_TYPES.includes(ruleType as BadgeRuleType) && Number.isFinite(threshold) && threshold >= 1) {
        out.push({ ruleType: ruleType as BadgeRuleType, threshold });
      }
    }
  }
  return out;
}

function statValue(ruleType: BadgeRuleType, stats: BadgeStats): number {
  switch (ruleType) {
    case "STREAK": return stats.streak;
    case "TOTAL_POINTS": return stats.pointsTotal;
    case "TOTAL_COMPLETIONS": return stats.totalCompletions;
    case "POINTS_IN_DAY": return stats.maxPointsInADay;
  }
}

/**
 * Earned when the badge applies to this user (empty list = everyone) AND
 * every condition is met. A badge with no valid conditions is never earned
 * (fail closed; write validation makes that unreachable in practice).
 */
export function badgeEarned(badge: Badge, stats: BadgeStats, userId: string): boolean {
  if (badge.appliesToUserIds.length > 0 && !badge.appliesToUserIds.includes(userId)) {
    return false;
  }
  const conditions = parseBadgeConditions(badge);
  if (conditions.length === 0)
    return false;
  return conditions.every(c => statValue(c.ruleType, stats) >= c.threshold);
}

/**
 * Validate a raw conditions payload from a badge write: non-empty array of
 * known rule types with positive integer thresholds. Throws 400 otherwise.
 */
export function validateBadgeConditions(raw: unknown): BadgeCondition[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw createError({ statusCode: 400, statusMessage: "conditions must be a non-empty array" });
  }
  return raw.map((c) => {
    const ruleType = (c as Record<string, unknown>)?.ruleType;
    const threshold = Number.parseInt(String((c as Record<string, unknown>)?.threshold), 10);
    if (!BADGE_RULE_TYPES.includes(ruleType as BadgeRuleType)) {
      throw createError({ statusCode: 400, statusMessage: `ruleType must be one of ${BADGE_RULE_TYPES.join(", ")}` });
    }
    if (!Number.isInteger(threshold) || threshold < 1) {
      throw createError({ statusCode: 400, statusMessage: "each threshold must be a positive integer" });
    }
    return { ruleType: ruleType as BadgeRuleType, threshold };
  });
}

/** Validate appliesToUserIds from a badge write: every id must be an existing member. */
export async function validateBadgeAppliesTo(raw: unknown): Promise<string[]> {
  const ids = Array.isArray(raw)
    ? [...new Set(raw.filter((x): x is string => typeof x === "string" && !!x))]
    : [];
  if (ids.length > 0) {
    const count = await prisma.user.count({ where: { id: { in: ids } } });
    if (count !== ids.length) {
      throw createError({ statusCode: 400, statusMessage: "appliesToUserIds contains an unknown member" });
    }
  }
  return ids;
}
