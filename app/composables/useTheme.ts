import type { ThemeName } from "~/types/ui";

/**
 * Resolves the per-device theme preference (and the global auto-seasonal
 * setting) into the *effective* theme, applies it as `data-theme` on <html>,
 * and celebrates an active switch. Also exposes the effective theme + whether
 * decorations are enabled, for the <ThemeDecor> overlay.
 *
 * Call this ONCE near the app root (app.vue) — it owns the DOM watcher.
 */
export function useTheme() {
  const { preferences } = useClientPreferences();
  const { config } = useFamilyConfig();

  const autoSeasonalGlobal = computed(() => config.value.autoSeasonalTheme === "true");

  // "auto" follows the calendar on this device. The global setting makes
  // *default* devices follow it too. Any explicit non-default theme wins (a
  // manual override always beats auto-seasonal).
  const effectiveTheme = computed<ThemeName>(() => {
    const pref = preferences.value?.theme ?? "default";
    if (pref === "auto")
      return seasonalThemeFor() ?? "default";
    if (pref === "default" && autoSeasonalGlobal.value)
      return seasonalThemeFor() ?? "default";
    return pref;
  });

  // Per-device ambient decorations; on by default.
  const decorEnabled = computed(() => preferences.value?.themeDecorEnabled !== false);

  if (import.meta.client) {
    watch(
      effectiveTheme,
      (value, old) => {
        const el = document.documentElement;
        if (value === "default")
          el.removeAttribute("data-theme");
        else
          el.dataset.theme = value;
        // Celebrate an *active* switch (not the initial apply on load).
        if (old !== undefined && old !== value && value !== "default")
          void celebrateTheme(value);
      },
      { immediate: true },
    );
  }

  return { effectiveTheme, decorEnabled };
}
