import type { Ref } from "vue";

import { consola } from "consola";

export type SchoolItem = {
  id: string;
  title: string;
  description: string | null;
  points: number;
  dueDate: string;
  userId: string;
  done: boolean;
  completedAt: string | null;
};

export type CreateSchoolItemInput = {
  title: string;
  description?: string;
  points: number;
  dueDate: string;
  userIds: string[];
};

export type SchoolCompleteResult = {
  ok: boolean;
  userId: string;
  newBadges: { key: string; label: string; icon: string }[];
  pointsToday: number;
  streak: number;
};

function localDateString(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * School items for the week starting at `weekStart` (Mon–Fri grid range);
 * the API also carries forward incomplete overdue items from before it.
 */
export function useSchoolItems(weekStart: Ref<string>) {
  const error = ref<string | null>(null);
  const requestFetch = useRequestFetch();
  const today = localDateString();

  const { data: items, refresh } = useAsyncData(
    () => `school-items-${weekStart.value}`,
    () => requestFetch<SchoolItem[]>("/api/school-items", {
      query: { start: weekStart.value, end: addDaysIso(weekStart.value, 6) },
    }),
    { default: () => [], server: false, watch: [weekStart] },
  );

  const itemsByUser = computed(() => {
    const map: Record<string, SchoolItem[]> = {};
    for (const i of items.value ?? []) {
      (map[i.userId] ??= []).push(i);
    }
    return map;
  });

  async function createItem(input: CreateSchoolItemInput) {
    try {
      const created = await $fetch("/api/school-items", { method: "POST", body: input });
      await refresh();
      return created;
    }
    catch (err) {
      error.value = "Failed to add school item";
      consola.error("useSchoolItems create:", err);
      throw err;
    }
  }

  async function updateItem(id: string, updates: Partial<Omit<CreateSchoolItemInput, "userIds">> & { userId?: string }) {
    try {
      const updated = await $fetch(`/api/school-items/${id}`, { method: "PUT", body: updates });
      await refresh();
      return updated;
    }
    catch (err) {
      error.value = "Failed to update school item";
      consola.error("useSchoolItems update:", err);
      throw err;
    }
  }

  async function removeItem(id: string) {
    try {
      await $fetch(`/api/school-items/${id}`, { method: "DELETE" });
      await refresh();
    }
    catch (err) {
      error.value = "Failed to delete school item";
      consola.error("useSchoolItems remove:", err);
      throw err;
    }
  }

  async function setDone(id: string, done: boolean): Promise<SchoolCompleteResult | null> {
    try {
      let result: SchoolCompleteResult | null = null;
      if (done) {
        result = await $fetch<SchoolCompleteResult>(`/api/school-items/${id}/complete`, {
          method: "POST",
          body: { localDate: today },
        });
      }
      else {
        await $fetch(`/api/school-items/${id}/complete`, { method: "DELETE" });
      }
      await refresh();
      return result;
    }
    catch (err) {
      error.value = "Failed to update school item";
      consola.error("useSchoolItems setDone:", err);
      throw err;
    }
  }

  return {
    items,
    itemsByUser,
    refresh,
    createItem,
    updateItem,
    removeItem,
    setDone,
    today,
    error: readonly(error),
  };
}
