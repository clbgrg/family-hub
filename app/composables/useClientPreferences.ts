import { useStorage } from "@vueuse/core";

import type { ClientPreferences } from "~/types/ui";

import { defaultClientPreferences, getFontStack } from "~/types/ui";

const STORAGE_KEY = "skylite-client-preferences";

export function useClientPreferences() {
  const preferences = useStorage<ClientPreferences>(
    STORAGE_KEY,
    defaultClientPreferences,
    undefined,
    { mergeDefaults: true },
  );

  function updatePreferences(partial: Partial<ClientPreferences>) {
    preferences.value = { ...preferences.value, ...partial };
  }

  if (import.meta.client) {
    const colorMode = useColorMode();
    const resolved = computed(() => {
      const mode = preferences.value?.colorMode ?? "system";
      if (mode === "system") {
        return typeof window !== "undefined"
          && window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      }
      return mode;
    });
    watch(
      resolved,
      (value) => {
        colorMode.preference = value;
      },
      { immediate: true },
    );
    const font = computed(
      () => preferences.value?.font ?? ("system" as const),
    );
    watch(
      font,
      (value) => {
        document.documentElement.style.setProperty(
          "--app-font-sans",
          getFontStack(value),
        );
      },
      { immediate: true },
    );

    // Site-wide theme → a `data-theme` attribute on <html> that the CSS in
    // main.css keys off. "default" clears it (standard light/dark tokens).
    const theme = computed(() => preferences.value?.theme ?? "default");
    watch(
      theme,
      (value, old) => {
        const el = document.documentElement;
        if (value === "default")
          el.removeAttribute("data-theme");
        else
          el.dataset.theme = value;
        // A little celebration when someone actively switches to Birthday
        // (not on every page load where it's already the saved theme).
        if (value === "birthday" && old !== undefined && old !== "birthday") {
          import("canvas-confetti")
            .then(m => m.default({ particleCount: 120, spread: 80, origin: { y: 0.3 } }))
            .catch(() => {});
        }
      },
      { immediate: true },
    );
  }

  return {
    preferences,
    updatePreferences,
  };
}
