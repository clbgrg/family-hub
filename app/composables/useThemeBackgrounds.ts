export type ThemeBgEntry = {
  storedName: string;
  name?: string;
  type?: string;
  brightness?: number;
  blur?: number;
};

/**
 * Per-theme custom background images, shared family-wide via the
 * `themeBackgrounds` Setting. Reads the map through useFamilyConfig; uploads /
 * removes / adjustments hit the theme-backgrounds + settings endpoints (admin /
 * elevated — callers should wrap them in useAdminGate().gate()).
 */
export function useThemeBackgrounds() {
  const { config, save, refresh } = useFamilyConfig();

  const map = computed<Record<string, ThemeBgEntry>>(() => {
    const raw = config.value.themeBackgrounds;
    if (!raw)
      return {};
    try {
      const m = JSON.parse(raw);
      return m && typeof m === "object" ? m : {};
    }
    catch {
      return {};
    }
  });

  function forTheme(theme: string | undefined | null): ThemeBgEntry | null {
    return theme ? map.value[theme] ?? null : null;
  }

  function urlFor(storedName: string): string {
    return `/api/theme-backgrounds/${encodeURIComponent(storedName)}`;
  }

  async function upload(theme: string, file: File) {
    const fd = new FormData();
    fd.append("theme", theme);
    fd.append("file", file);
    await $fetch("/api/theme-backgrounds", { method: "POST", body: fd });
    await refresh();
  }

  async function remove(theme: string) {
    await $fetch(`/api/theme-backgrounds/${encodeURIComponent(theme)}`, { method: "DELETE" });
    await refresh();
  }

  // Brightness/blur tweaks don't touch the file — just patch the shared map.
  async function setAdjust(theme: string, patch: { brightness?: number; blur?: number }) {
    const cur = map.value[theme];
    if (!cur)
      return;
    const next = { ...map.value, [theme]: { ...cur, ...patch } };
    await save({ themeBackgrounds: JSON.stringify(next) });
  }

  return { map, forTheme, urlFor, upload, remove, setAdjust, refresh };
}
