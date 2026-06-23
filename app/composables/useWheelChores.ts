// The chore "punishment wheel" list — a standalone, family-shared set of chore
// names (independent of the chore board), persisted as a JSON string in the
// `wheelChores` Setting via /api/settings. Management is admin-gated by callers;
// spinning is open to everyone.

export const DEFAULT_WHEEL_CHORES = [
  "Clean the bathroom",
  "Take out the trash",
  "Vacuum the living room",
  "Do the dishes",
  "Wipe the counters",
  "Sweep the kitchen",
  "Tidy your room",
  "Empty the dishwasher",
];

/**
 * Parse the stored `wheelChores` value (JSON array of strings). An unset value
 * falls back to the defaults; an explicit empty array (the user cleared it)
 * stays empty. Pure + testable.
 */
export function parseWheelChores(raw: string | undefined | null): string[] {
  if (raw == null || raw === "")
    return [...DEFAULT_WHEEL_CHORES];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [...DEFAULT_WHEEL_CHORES];
  }
  catch {
    return [...DEFAULT_WHEEL_CHORES];
  }
}

export function useWheelChores() {
  const { config, save, refresh } = useFamilyConfig();

  const chores = computed(() => parseWheelChores(config.value.wheelChores));

  function persist(list: string[]) {
    return save({ wheelChores: JSON.stringify(list) });
  }

  return {
    chores,
    refresh,
    async add(title: string) {
      const t = title.trim();
      if (t)
        await persist([...chores.value, t]);
    },
    async edit(index: number, title: string) {
      const t = title.trim();
      if (!t || index < 0 || index >= chores.value.length)
        return;
      const next = [...chores.value];
      next[index] = t;
      await persist(next);
    },
    async remove(index: number) {
      await persist(chores.value.filter((_, i) => i !== index));
    },
    clear() {
      return persist([]);
    },
    reset() {
      return persist([...DEFAULT_WHEEL_CHORES]);
    },
  };
}
