import { consola } from "consola";

export type PointAdjustmentEntry = {
  id: string;
  userId: string;
  delta: number;
  reason: string;
  localDate: string;
  createdAt: string;
  user: { id: string; name: string; avatar: string | null };
  createdBy: { id: string; name: string } | null;
};

export type CreateAdjustmentInput = {
  userId: string;
  delta: number;
  reason: string;
  localDate: string;
};

/** Manual point adjustments (parent deductions/bonuses) — see /api/adjustments. */
export function useAdjustments() {
  const error = ref<string | null>(null);
  const requestFetch = useRequestFetch();

  const { data: adjustments, refresh } = useAsyncData(
    "adjustments",
    () => requestFetch<PointAdjustmentEntry[]>("/api/adjustments"),
    { default: () => [], server: false },
  );

  async function createAdjustment(input: CreateAdjustmentInput) {
    try {
      const created = await $fetch("/api/adjustments", { method: "POST", body: input });
      await refresh();
      return created;
    }
    catch (err) {
      error.value = "Failed to apply adjustment";
      consola.error("useAdjustments create:", err);
      throw err;
    }
  }

  async function removeAdjustment(id: string) {
    try {
      await $fetch(`/api/adjustments/${id}`, { method: "DELETE" });
      await refresh();
    }
    catch (err) {
      error.value = "Failed to remove adjustment";
      consola.error("useAdjustments remove:", err);
      throw err;
    }
  }

  return { adjustments, refresh, createAdjustment, removeAdjustment, error: readonly(error) };
}
