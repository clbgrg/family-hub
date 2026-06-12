import type { Badge } from "@prisma/client";

import prisma from "~/lib/prisma";

import type { CompletionEvent } from "./points";

// Rule types live as a TS union now (the Prisma enum was dropped when badges
// moved to JSON conditions); writes are validated against this list.
// The first four compare an aggregate stat ≥ threshold. The rest evaluate the
// completion-event history itself (when/how much each task was worth):
//   EARLY_BIRD             — ≥ threshold completions before `beforeHour` (family-local time)
//   WEEKEND_COMPLETIONS    — ≥ threshold completions on a Saturday/Sunday
//   HIGH_VALUE_COMPLETIONS — ≥ threshold completions each worth ≥ `minPoints`
//   ROLLING_AVG_POINTS     — avg points/task ≥ threshold across the most recent
//                            `window` completions (needs at least `window` of them)
export const BADGE_RULE_TYPES = [
  "STREAK",
  "TOTAL_POINTS",
  "TOTAL_COMPLETIONS",
  "POINTS_IN_DAY",
  "EARLY_BIRD",
  "WEEKEND_COMPLETIONS",
  "HIGH_VALUE_COMPLETIONS",
  "ROLLING_AVG_POINTS",
] as const;
export type BadgeRuleType = (typeof BADGE_RULE_TYPES)[number];

export type BadgeCondition = {
  ruleType: BadgeRuleType;
  threshold: number;
  beforeHour?: number; // EARLY_BIRD: completions strictly before this hour (0–23)
  minPoints?: number; // HIGH_VALUE_COMPLETIONS: each completion worth at least this
  window?: number; // ROLLING_AVG_POINTS: how many recent completions to average
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
  { key: "EARLY_BIRD", name: "Early Bird", icon: "i-lucide-sunrise", description: "Finished a task before 8am", conditions: [{ ruleType: "EARLY_BIRD", threshold: 1, beforeHour: 8 }], order: 5 },
  { key: "WEEKEND_WARRIOR", name: "Weekend Warrior", icon: "i-lucide-swords", description: "Completed 10 weekend tasks", conditions: [{ ruleType: "WEEKEND_COMPLETIONS", threshold: 10 }], order: 6 },
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

// Per-rule extra-parameter spec: name + allowed range. Shared by the lenient
// read path (parse) and the strict write path (validate).
const RULE_PARAMS: Partial<Record<BadgeRuleType, { param: "beforeHour" | "minPoints" | "window"; min: number; max: number }>> = {
  EARLY_BIRD: { param: "beforeHour", min: 0, max: 23 },
  HIGH_VALUE_COMPLETIONS: { param: "minPoints", min: 1, max: Number.MAX_SAFE_INTEGER },
  ROLLING_AVG_POINTS: { param: "window", min: 1, max: 1000 },
};

/** Parse a badge's JSON conditions, dropping anything malformed (fail closed). */
export function parseBadgeConditions(badge: Pick<Badge, "conditions">): BadgeCondition[] {
  const raw = badge.conditions;
  if (!Array.isArray(raw))
    return [];
  const out: BadgeCondition[] = [];
  for (const c of raw) {
    if (c && typeof c === "object" && !Array.isArray(c)) {
      const rec = c as Record<string, unknown>;
      const ruleType = rec.ruleType;
      const threshold = Number(rec.threshold);
      if (!BADGE_RULE_TYPES.includes(ruleType as BadgeRuleType) || !Number.isFinite(threshold) || threshold < 1) {
        continue;
      }
      const condition: BadgeCondition = { ruleType: ruleType as BadgeRuleType, threshold };
      const spec = RULE_PARAMS[condition.ruleType];
      if (spec) {
        const value = Number(rec[spec.param]);
        if (!Number.isInteger(value) || value < spec.min || value > spec.max) {
          continue;
        }
        condition[spec.param] = value;
      }
      out.push(condition);
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
    default: return 0; // event-based rules don't read aggregate stats
  }
}

/**
 * The hour-of-day a completion happened in the family's timezone (the server
 * runs in UTC inside Docker). Falls back to server-local time if the tz is
 * missing or invalid.
 */
function localHour(date: Date, tz: string | undefined): number {
  if (tz) {
    try {
      // hour12:false can yield "24" for midnight in some ICU versions.
      return Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: tz }).format(date)) % 24;
    }
    catch {
      // bad tz string — fall through
    }
  }
  return date.getHours();
}

/** Is a YYYY-MM-DD local date a Saturday or Sunday? (noon-UTC parse avoids tz drift) */
function isWeekendDate(localDate: string): boolean {
  const day = new Date(`${localDate}T12:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

function conditionMet(
  c: BadgeCondition,
  stats: BadgeStats,
  events: CompletionEvent[],
  tz: string | undefined,
): boolean {
  switch (c.ruleType) {
    case "EARLY_BIRD":
      return events.filter(e => localHour(e.completedAt, tz) < c.beforeHour!).length >= c.threshold;
    case "WEEKEND_COMPLETIONS":
      return events.filter(e => isWeekendDate(e.localDate)).length >= c.threshold;
    case "HIGH_VALUE_COMPLETIONS":
      return events.filter(e => e.points >= c.minPoints!).length >= c.threshold;
    case "ROLLING_AVG_POINTS": {
      const window = c.window!;
      if (events.length < window)
        return false; // a 1-task "average" shouldn't trip a 50-task consistency badge
      const recent = [...events]
        .sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime())
        .slice(-window);
      const avg = recent.reduce((sum, e) => sum + e.points, 0) / window;
      return avg >= c.threshold;
    }
    default:
      return statValue(c.ruleType, stats) >= c.threshold;
  }
}

/**
 * Earned when the badge applies to this user (empty list = everyone) AND
 * every condition is met. A badge with no valid conditions is never earned
 * (fail closed; write validation makes that unreachable in practice).
 * `events` feeds the time/difficulty rules; `tz` is the family timezone
 * (defaults to NUXT_PUBLIC_TZ, the same zone the kiosk displays).
 */
export function badgeEarned(
  badge: Badge,
  stats: BadgeStats,
  userId: string,
  events: CompletionEvent[] = [],
  // eslint-disable-next-line node/no-process-env -- family tz; read here (not via useRuntimeConfig) so the util works outside Nitro (unit tests)
  tz: string | undefined = process.env.NUXT_PUBLIC_TZ,
): boolean {
  if (badge.appliesToUserIds.length > 0 && !badge.appliesToUserIds.includes(userId)) {
    return false;
  }
  const conditions = parseBadgeConditions(badge);
  if (conditions.length === 0)
    return false;
  return conditions.every(c => conditionMet(c, stats, events, tz));
}

/**
 * Validate a raw conditions payload from a badge write: non-empty array of
 * known rule types with positive integer thresholds (plus a valid extra
 * parameter where the rule needs one). Throws 400 otherwise.
 */
export function validateBadgeConditions(raw: unknown): BadgeCondition[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw createError({ statusCode: 400, statusMessage: "conditions must be a non-empty array" });
  }
  return raw.map((c) => {
    const rec = c as Record<string, unknown>;
    const ruleType = rec?.ruleType;
    const threshold = Number.parseInt(String(rec?.threshold), 10);
    if (!BADGE_RULE_TYPES.includes(ruleType as BadgeRuleType)) {
      throw createError({ statusCode: 400, statusMessage: `ruleType must be one of ${BADGE_RULE_TYPES.join(", ")}` });
    }
    if (!Number.isInteger(threshold) || threshold < 1) {
      throw createError({ statusCode: 400, statusMessage: "each threshold must be a positive integer" });
    }
    const condition: BadgeCondition = { ruleType: ruleType as BadgeRuleType, threshold };
    const spec = RULE_PARAMS[condition.ruleType];
    if (spec) {
      const value = Number.parseInt(String(rec?.[spec.param]), 10);
      if (!Number.isInteger(value) || value < spec.min || value > spec.max) {
        throw createError({ statusCode: 400, statusMessage: `${condition.ruleType} requires ${spec.param} between ${spec.min} and ${spec.max}` });
      }
      condition[spec.param] = value;
    }
    return condition;
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
