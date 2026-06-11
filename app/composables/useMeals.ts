import type { Ref } from "vue";

import { consola } from "consola";

export type MealSlot = "BREAKFAST" | "LUNCH" | "DINNER";

export type MealCook = {
  id: string;
  name: string;
  avatar: string | null;
  color: string | null;
};

export type Meal = {
  id: string;
  date: string;
  slot: MealSlot;
  title: string;
  notes: string | null;
  ingredients: string | null;
  time: string | null;
  cookId: string | null;
  cook: MealCook | null;
};

export type UpsertMealInput = {
  date: string;
  slot: MealSlot;
  title: string;
  notes?: string;
  ingredients?: string;
  time?: string;
  cookId?: string | null;
};

/** Meals for the given (navigable) week. `weekStart` is a YYYY-MM-DD Sunday. */
export function useMeals(weekStart: Ref<string>) {
  const error = ref<string | null>(null);
  const requestFetch = useRequestFetch();

  const start = computed(() => weekStart.value);
  const end = computed(() => addDaysIso(start.value, 6));

  // Client-only (client-local week + cookie), refetches when the week changes.
  const { data: meals, refresh } = useAsyncData(
    "meals",
    () => requestFetch<Meal[]>("/api/meals", { query: { start: start.value, end: end.value } }),
    { default: () => [], server: false, watch: [start] },
  );

  const mealByCell = computed(() => {
    const map: Record<string, Meal> = {};
    for (const m of meals.value ?? []) map[`${m.date}|${m.slot}`] = m;
    return map;
  });

  async function upsertMeal(input: UpsertMealInput) {
    try {
      await $fetch("/api/meals", { method: "PUT", body: input });
      await refresh();
    }
    catch (err) {
      error.value = "Failed to save meal";
      consola.error("useMeals upsert:", err);
      throw err;
    }
  }

  async function deleteMeal(id: string) {
    try {
      await $fetch(`/api/meals/${id}`, { method: "DELETE" });
      await refresh();
    }
    catch (err) {
      error.value = "Failed to clear meal";
      consola.error("useMeals delete:", err);
      throw err;
    }
  }

  async function generateGroceries() {
    return $fetch<{ ok: boolean; listId: string; listName: string; count: number }>(
      "/api/meals/groceries",
      { method: "POST", body: { start: start.value, end: end.value } },
    );
  }

  return { meals, mealByCell, error: readonly(error), upsertMeal, deleteMeal, generateGroceries, refresh };
}
