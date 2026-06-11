export type BadgeRuleType = "STREAK" | "TOTAL_POINTS" | "TOTAL_COMPLETIONS" | "POINTS_IN_DAY";

export type BadgeCondition = {
  ruleType: BadgeRuleType;
  threshold: number;
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
};

/** Human summary of a badge's conditions, e.g. "7-day streak AND 500 points". */
export function badgeConditionSummary(conditions: BadgeCondition[]): string {
  if (!conditions.length)
    return "No conditions";
  return conditions
    .map(c => `${BADGE_RULE_LABELS[c.ruleType]} ${c.threshold}`)
    .join(" AND ");
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
