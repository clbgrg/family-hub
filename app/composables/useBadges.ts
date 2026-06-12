export type BadgeRuleType
  = | "STREAK"
    | "TOTAL_POINTS"
    | "TOTAL_COMPLETIONS"
    | "POINTS_IN_DAY"
    | "EARLY_BIRD"
    | "WEEKEND_COMPLETIONS"
    | "HIGH_VALUE_COMPLETIONS"
    | "ROLLING_AVG_POINTS";

export type BadgeCondition = {
  ruleType: BadgeRuleType;
  threshold: number;
  beforeHour?: number; // EARLY_BIRD: completions strictly before this hour (0–23)
  minPoints?: number; // HIGH_VALUE_COMPLETIONS: each completion worth at least this
  window?: number; // ROLLING_AVG_POINTS: how many recent completions to average
};

export type BadgeDef = {
  id: string;
  key: string;
  name: string;
  icon: string;
  description: string | null;
  conditions: BadgeCondition[]; // ALL must be met (ANDed)
  appliesToUserIds: string[]; // empty = everyone
  order: number;
};

export type CreateBadgeInput = {
  name: string;
  icon: string;
  description?: string;
  conditions: BadgeCondition[];
  appliesToUserIds: string[];
};

export const BADGE_RULE_LABELS: Record<BadgeRuleType, string> = {
  STREAK: "Day streak ≥",
  TOTAL_POINTS: "Total points earned ≥",
  TOTAL_COMPLETIONS: "Total chores + school items done ≥",
  POINTS_IN_DAY: "Points in one day ≥",
  EARLY_BIRD: "Tasks done before an hour ≥",
  WEEKEND_COMPLETIONS: "Weekend tasks done ≥",
  HIGH_VALUE_COMPLETIONS: "Big tasks done ≥",
  ROLLING_AVG_POINTS: "Avg points per task ≥",
};

/** One condition as a human phrase (used by tooltips and the editor preview). */
export function badgeConditionLabel(c: BadgeCondition): string {
  switch (c.ruleType) {
    case "EARLY_BIRD":
      return `${c.threshold} task${c.threshold === 1 ? "" : "s"} done before ${c.beforeHour ?? "?"}:00`;
    case "WEEKEND_COMPLETIONS":
      return `${c.threshold} weekend task${c.threshold === 1 ? "" : "s"}`;
    case "HIGH_VALUE_COMPLETIONS":
      return `${c.threshold} task${c.threshold === 1 ? "" : "s"} worth ≥${c.minPoints ?? "?"} pts each`;
    case "ROLLING_AVG_POINTS":
      return `avg ≥${c.threshold} pts over the last ${c.window ?? "?"} tasks`;
    default:
      return `${BADGE_RULE_LABELS[c.ruleType]} ${c.threshold}`;
  }
}

/** Human summary of a badge's conditions, e.g. "7-day streak AND 500 points". */
export function badgeConditionSummary(conditions: BadgeCondition[]): string {
  if (!conditions.length)
    return "No conditions";
  return conditions.map(badgeConditionLabel).join(" AND ");
}

export function useBadges() {
  const requestFetch = useRequestFetch();
  const { data: badges, refresh } = useAsyncData(
    "badges",
    () => requestFetch<BadgeDef[]>("/api/badges"),
    { default: () => [], server: false },
  );

  async function createBadge(input: CreateBadgeInput) {
    await $fetch("/api/badges", { method: "POST", body: input });
    await refresh();
  }
  async function updateBadge(id: string, input: Partial<CreateBadgeInput>) {
    await $fetch(`/api/badges/${id}`, { method: "PUT", body: input });
    await refresh();
  }
  async function deleteBadge(id: string) {
    await $fetch(`/api/badges/${id}`, { method: "DELETE" });
    await refresh();
  }

  return { badges, refresh, createBadge, updateBadge, deleteBadge };
}
