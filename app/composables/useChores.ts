import { consola } from "consola";

export type ChoreRecurrence = "ONCE" | "DAILY" | "WEEKLY";

export type ChoreAssignee = {
  id: string;
  name: string;
  avatar: string | null;
  color: string | null;
};

export type AreaInfo = { id: string; name: string; icon: string | null; order: number };

// One board row per (chore × assignee): a chore assigned to both kids shows
// as two rows, each with its own done state. `id` therefore repeats — use
// `${id}:${assignee.id}` as the render key.
export type ChoreBoardItem = {
  id: string;
  title: string;
  description: string | null;
  points: number;
  recurrence: ChoreRecurrence;
  daysOfWeek: number[];
  order: number;
  area: AreaInfo | null;
  startDate: string | null;
  endDate: string | null;
  pausedUntil: string | null;
  rotate: boolean;
  assignee: ChoreAssignee | null;
  assigneeIds: string[];
  dueToday: boolean;
  done: boolean;
};

export type NewBadge = {
  key: string;
  label: string;
  icon: string;
};

// Stats payload badges carry tooltip metadata (description, earned date).
export type EarnedBadge = NewBadge & {
  description?: string | null;
  earnedAt?: string;
};

export type ChoreStats = {
  userId: string;
  pointsTotal: number;
  pointsToday: number;
  pointsWeek: number;
  streak: number;
  badges: EarnedBadge[];
};

export type CompleteResult = {
  ok: boolean;
  assigneeId: string;
  newBadges: NewBadge[];
  allDoneToday: boolean;
  pointsToday: number;
  streak: number;
};

export type CreateChoreInput = {
  title: string;
  description?: string;
  points: number;
  recurrence: ChoreRecurrence;
  daysOfWeek?: number[];
  assigneeIds: string[];
  areaId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  pausedUntil?: string | null;
  rotate?: boolean;
};

export type AreaGroup<T> = { area: AreaInfo | null; chores: T[] };

/** Short schedule tag for a chore row: "Daily" | "Weekly" | "One-time". */
export function recurrenceLabel(chore: { recurrence: ChoreRecurrence }): string {
  switch (chore.recurrence) {
    case "ONCE":
      return "One-time";
    case "WEEKLY":
      return "Weekly";
    default:
      return "Daily";
  }
}

/**
 * Group board rows by Area, preserving area order with un-areaed chores in a
 * trailing "Other" group (area: null). Empty groups are omitted.
 */
export function groupChoresByArea<T extends { area: AreaInfo | null }>(chores: T[]): AreaGroup<T>[] {
  const groups = new Map<string, AreaGroup<T>>();
  for (const c of chores) {
    const key = c.area?.id ?? "__none__";
    let g = groups.get(key);
    if (!g) {
      g = { area: c.area ?? null, chores: [] };
      groups.set(key, g);
    }
    g.chores.push(c);
  }
  return [...groups.values()].sort((a, b) => {
    if (!a.area)
      return b.area ? 1 : 0;
    if (!b.area)
      return -1;
    return a.area.order - b.area.order || a.area.name.localeCompare(b.area.name);
  });
}

/**
 * Client-local date "YYYY-MM-DD" — the server is UTC, so done-today logic
 *  must key off the client's day (mirrors useTodos' clientDate pattern).
 */
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

  const { data: stats, refresh: refreshStats } = useAsyncData(
    "chore-stats",
    () => requestFetch<ChoreStats[]>("/api/chores/stats", { query: { date: today } }),
    { default: () => [], server: false },
  );

  const statsByUser = computed(() => {
    const map: Record<string, ChoreStats> = {};
    for (const s of stats.value ?? []) map[s.userId] = s;
    return map;
  });

  const pointsByUser = computed(() => {
    const map: Record<string, number> = {};
    for (const s of stats.value ?? []) map[s.userId] = s.pointsTotal;
    return map;
  });

  // Weekly-points ranking (highest first).
  const leaderboard = computed(() =>
    [...(stats.value ?? [])].sort((a, b) => b.pointsWeek - a.pointsWeek),
  );

  async function refreshAll() {
    await Promise.all([refreshChores(), refreshStats()]);
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

  // Check a chore off (or undo) for the client's today, for one assignee —
  // always pass the board row's assignee id, since a chore can have several
  // and the server credits the TARGET user (admin can complete for a kid).
  // Completing returns the celebration payload.
  async function setDone(id: string, done: boolean, userId: string): Promise<CompleteResult | null> {
    try {
      let result: CompleteResult | null = null;
      if (done) {
        result = await $fetch<CompleteResult>(`/api/chores/${id}/complete`, {
          method: "POST",
          body: { localDate: today, userId },
        });
      }
      else {
        await $fetch(`/api/chores/${id}/complete`, { method: "DELETE", query: { localDate: today, userId } });
      }
      await refreshAll();
      return result;
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
    statsByUser,
    leaderboard,
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
