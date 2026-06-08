import { consola } from "consola";

export type ChoreRecurrence = "ONCE" | "DAILY" | "WEEKLY";

export interface ChoreAssignee {
  id: string;
  name: string;
  avatar: string | null;
  color: string | null;
}

export interface ChoreBoardItem {
  id: string;
  title: string;
  description: string | null;
  points: number;
  recurrence: ChoreRecurrence;
  daysOfWeek: number[];
  order: number;
  assignee: ChoreAssignee | null;
  dueToday: boolean;
  done: boolean;
}

export interface ChorePoints {
  userId: string;
  points: number;
}

export interface CreateChoreInput {
  title: string;
  description?: string;
  points: number;
  recurrence: ChoreRecurrence;
  daysOfWeek?: number[];
  assigneeId: string;
}

/** Client-local date "YYYY-MM-DD" — the server is UTC, so done-today logic
 *  must key off the client's day (mirrors useTodos' clientDate pattern). */
function localDateString(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function useChores() {
  const error = ref<string | null>(null);
  const today = localDateString();

  // Forward the request cookie during SSR (raw $fetch does not), so the first
  // server render is authenticated rather than 401 → empty board.
  const requestFetch = useRequestFetch();

  // Client-only: `today` must be the client's local date (the server is UTC),
  // and the board is per-user/time-sensitive — so fetch on the client where the
  // date and cookie are correct, avoiding SSR/UTC hydration mismatches.
  const { data: chores, refresh: refreshChores, pending } = useAsyncData(
    "chores",
    () => requestFetch<ChoreBoardItem[]>("/api/chores", { query: { date: today } }),
    { default: () => [], server: false },
  );

  const { data: points, refresh: refreshPoints } = useAsyncData(
    "chore-points",
    () => requestFetch<ChorePoints[]>("/api/chores/points"),
    { default: () => [], server: false },
  );

  const pointsByUser = computed(() => {
    const map: Record<string, number> = {};
    for (const p of points.value ?? []) map[p.userId] = p.points;
    return map;
  });

  async function refreshAll() {
    await Promise.all([refreshChores(), refreshPoints()]);
  }

  async function createChore(input: CreateChoreInput) {
    try {
      const created = await $fetch("/api/chores", { method: "POST", body: input });
      await refreshAll();
      return created;
    }
    catch (err) {
      error.value = "Failed to create chore";
      consola.error("useChores create:", err);
      throw err;
    }
  }

  async function updateChore(id: string, updates: Partial<CreateChoreInput> & { active?: boolean }) {
    try {
      const updated = await $fetch(`/api/chores/${id}`, { method: "PUT", body: updates });
      await refreshAll();
      return updated;
    }
    catch (err) {
      error.value = "Failed to update chore";
      consola.error("useChores update:", err);
      throw err;
    }
  }

  async function deleteChore(id: string) {
    try {
      await $fetch(`/api/chores/${id}`, { method: "DELETE" });
      await refreshAll();
    }
    catch (err) {
      error.value = "Failed to delete chore";
      consola.error("useChores delete:", err);
      throw err;
    }
  }

  // Check a chore off (or undo) for the client's today.
  async function setDone(id: string, done: boolean) {
    try {
      if (done) {
        await $fetch(`/api/chores/${id}/complete`, { method: "POST", body: { localDate: today } });
      }
      else {
        await $fetch(`/api/chores/${id}/complete`, { method: "DELETE", query: { localDate: today } });
      }
      await refreshAll();
    }
    catch (err) {
      error.value = "Failed to update chore";
      consola.error("useChores setDone:", err);
      throw err;
    }
  }

  return {
    // not readonly-wrapped: mutations go through the methods below, and the
    // page passes board items into helpers typed as ChoreBoardItem.
    chores,
    pointsByUser,
    pending: readonly(pending),
    error: readonly(error),
    today,
    refreshAll,
    createChore,
    updateChore,
    deleteChore,
    setDone,
  };
}
