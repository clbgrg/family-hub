import type { Ref } from "vue";

export type HistoryActor = { id: string; name: string; avatar: string | null } | null;

export type HistoryEvent = {
  id: string;
  type: string;
  timestamp: string; // ISO string (Date is serialized over HTTP)
  actor: HistoryActor;
  summary: string;
};

/**
 * Family activity feed. `userId` is a filter ref: "" = everyone (admins only;
 * the server scopes a MEMBER to themselves regardless). Re-fetches on change.
 */
export function useHistory(userId: Ref<string>) {
  const requestFetch = useRequestFetch();
  const { data: events, refresh, pending } = useAsyncData(
    "history",
    () => requestFetch<HistoryEvent[]>("/api/history", {
      query: userId.value ? { userId: userId.value } : undefined,
    }),
    { default: () => [], server: false, watch: [userId] },
  );

  return { events, refresh, pending };
}
