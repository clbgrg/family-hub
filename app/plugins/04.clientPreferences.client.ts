import { consola } from "consola";

import type { ClientPreferences } from "~/types/ui";

import { getFontStack } from "~/types/ui";
import { seasonalThemeFor } from "~/utils/seasonalTheme";

const STORAGE_KEY = "skylite-client-preferences";

export default defineNuxtPlugin(() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const prefs = JSON.parse(raw) as ClientPreferences;
      const mode = prefs?.colorMode ?? "system";
      if (mode === "light" || mode === "dark") {
        const colorMode = useColorMode();
        colorMode.preference = mode;
      }
      const fontStack = getFontStack(prefs?.font);
      document.documentElement.style.setProperty("--app-font-sans", fontStack);

      // Apply the saved theme before first paint so there's no flash of the
      // default skin. "auto" resolves to today's seasonal theme (date-only, no
      // server needed). The global auto-seasonal setting for default-theme
      // devices applies just after hydration via useTheme().
      const savedTheme = prefs?.theme ?? "default";
      const resolvedTheme = savedTheme === "auto" ? (seasonalThemeFor() ?? "default") : savedTheme;
      if (resolvedTheme !== "default")
        document.documentElement.dataset.theme = resolvedTheme;
    }
  }
  catch (err) {
    consola.debug("Client preferences: could not restore from storage", err);
  }
});
