import { consola } from "consola";

import type { ClientPreferences } from "~/types/ui";

import { getFontStack } from "~/types/ui";

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
      // default skin. "default" (or unset) leaves the standard tokens.
      if (prefs?.theme && prefs.theme !== "default")
        document.documentElement.dataset.theme = prefs.theme;
    }
  }
  catch (err) {
    consola.debug("Client preferences: could not restore from storage", err);
  }
});
