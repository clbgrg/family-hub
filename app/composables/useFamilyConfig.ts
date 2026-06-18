// Household preferences (points label, grade scale, …). Backed by /api/settings;
// defaults live here so a missing key falls back gracefully. Shared via a single
// keyed useAsyncData so every caller reuses the same fetch.
const DEFAULT_POINTS_LABEL = "points";

export function useFamilyConfig() {
  const requestFetch = useRequestFetch();
  const { data: config, refresh } = useAsyncData(
    "family-config",
    () => requestFetch<Record<string, string>>("/api/settings"),
    { default: (): Record<string, string> => ({}), server: false },
  );

  const pointsLabel = computed(() => (config.value.pointsLabel ?? "").trim() || DEFAULT_POINTS_LABEL);
  const gradeScale = computed(() =>
    (config.value.gradeScale ?? "").split(",").map(s => s.trim()).filter(Boolean),
  );
  // Pinned weekly family note shown at the top of the dashboard.
  const pinnedNoteTitle = computed(() => (config.value.pinnedNoteTitle ?? "").trim());
  const pinnedNoteBody = computed(() => (config.value.pinnedNoteBody ?? "").trim());

  async function save(updates: Record<string, string>) {
    await $fetch("/api/settings", { method: "PUT", body: updates });
    await refresh();
  }

  return { config, pointsLabel, gradeScale, pinnedNoteTitle, pinnedNoteBody, save, refresh };
}
