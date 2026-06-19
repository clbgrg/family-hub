import { consola } from "consola";

export type SavedMeal = {
  id: string;
  title: string;
  notes: string | null;
  ingredients: string | null;
  // Usual days for this template (0=Sun .. 6=Sat).
  defaultDays: number[];
};

export type CreateSavedMealInput = {
  title: string;
  notes?: string;
  ingredients?: string;
  defaultDays?: number[];
};

/** The saved-meals repository (shared asyncData key). */
export function useSavedMeals() {
  const error = ref<string | null>(null);
  const requestFetch = useRequestFetch();

  const { data: savedMeals, refresh } = useAsyncData(
    "saved-meals",
    () => requestFetch<SavedMeal[]>("/api/saved-meals"),
    { default: () => [], server: false },
  );

  async function createSavedMeal(input: CreateSavedMealInput) {
    try {
      await $fetch("/api/saved-meals", { method: "POST", body: input });
      await refresh();
    }
    catch (err) {
      error.value = "Failed to save meal";
      consola.error("useSavedMeals create:", err);
      throw err;
    }
  }

  async function updateSavedMeal(id: string, input: CreateSavedMealInput) {
    try {
      await $fetch(`/api/saved-meals/${id}`, { method: "PUT", body: input });
      await refresh();
    }
    catch (err) {
      error.value = "Failed to update saved meal";
      consola.error("useSavedMeals update:", err);
      throw err;
    }
  }

  async function deleteSavedMeal(id: string) {
    try {
      await $fetch(`/api/saved-meals/${id}`, { method: "DELETE" });
      await refresh();
    }
    catch (err) {
      error.value = "Failed to delete saved meal";
      consola.error("useSavedMeals delete:", err);
      throw err;
    }
  }

  return { savedMeals, error: readonly(error), refresh, createSavedMeal, updateSavedMeal, deleteSavedMeal };
}
