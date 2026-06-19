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

    // NOTE: site-wide theme application (incl. auto-seasonal + switch bursts)
    // lives in useTheme(), called once from app.vue — not here.
  }

  return {
    preferences,
    updatePreferences,
  };
}
