export type AnalyticsUser = {
  userId: string;
  name: string;
  avatar: string | null;
  color: string | null;
  completions: number;
  points: number;
};

export type AnalyticsArea = {
  areaId: string | null;
  name: string;
  icon: string | null;
  completions: number;
};

export type AnalyticsChore = {
  choreId: string;
  title: string;
  points: number;
  recurrence: "ONCE" | "DAILY" | "WEEKLY";
  area: { id: string; name: string; icon: string | null } | null;
  completions: number;
};

export type Analytics = {
  windowDays: number;
  since: string;
  perUser: AnalyticsUser[];
  byArea: AnalyticsArea[];
  neglected: AnalyticsChore[];
};

export function useAnalytics(date: string) {
  const requestFetch = useRequestFetch();
  const { data: analytics, refresh } = useAsyncData(
    "chore-analytics",
    () => requestFetch<Analytics>("/api/chores/analytics", { query: { date } }),
    {
      default: (): Analytics => ({ windowDays: 30, since: "", perUser: [], byArea: [], neglected: [] }),
      server: false,
    },
  );
  return { analytics, refresh };
}
