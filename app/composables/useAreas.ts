export type Area = {
  id: string;
  name: string;
  icon: string | null; // emoji ("🧼") or a Lucide name ("i-lucide-utensils")
  order: number;
};

export type CreateAreaInput = {
  name: string;
  icon?: string | null;
};

export function useAreas() {
  const requestFetch = useRequestFetch();
  const { data: areas, refresh } = useAsyncData(
    "areas",
    () => requestFetch<Area[]>("/api/areas"),
    { default: () => [], server: false },
  );

  async function createArea(input: CreateAreaInput) {
    await $fetch("/api/areas", { method: "POST", body: input });
    await refresh();
  }
  async function updateArea(id: string, input: Partial<CreateAreaInput> & { order?: number }) {
    await $fetch(`/api/areas/${id}`, { method: "PUT", body: input });
    await refresh();
  }
  async function deleteArea(id: string) {
    await $fetch(`/api/areas/${id}`, { method: "DELETE" });
    await refresh();
  }

  return { areas, refresh, createArea, updateArea, deleteArea };
}
