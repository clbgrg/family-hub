export type BadgeRuleType = "STREAK" | "TOTAL_POINTS" | "TOTAL_COMPLETIONS" | "POINTS_IN_DAY";

export interface BadgeDef {
  id: string;
  key: string;
  name: string;
  icon: string;
  description: string | null;
  ruleType: BadgeRuleType;
  threshold: number;
  order: number;
}

export interface CreateBadgeInput {
  name: string;
  icon: string;
  description?: string;
  ruleType: BadgeRuleType;
  threshold: number;
}

export const BADGE_RULE_LABELS: Record<BadgeRuleType, string> = {
  STREAK: "Day streak ≥",
  TOTAL_POINTS: "Total points earned ≥",
  TOTAL_COMPLETIONS: "Total chores done ≥",
  POINTS_IN_DAY: "Points in one day ≥",
};

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
