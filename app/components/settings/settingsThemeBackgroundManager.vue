<script setup lang="ts">
import type { ThemeName } from "~/types/ui";

import { THEME_OPTIONS } from "~/types/ui";

// Manage per-theme custom background images (family-shared). Upload / preview /
// adjust (brightness + blur) / remove. Mutations are admin-gated via the shared
// PIN modal; the server endpoints also enforce elevation.
const { forTheme, urlFor, upload, remove, setAdjust } = useThemeBackgrounds();
const { gate } = useAdminGate();
const { preferences } = useClientPreferences();

// "auto" resolves to a seasonal theme, so it isn't directly configurable.
const themeOptions = THEME_OPTIONS.filter(t => t.value !== "auto");
const selected = ref<ThemeName>(
  preferences.value?.theme && preferences.value.theme !== "auto" ? preferences.value.theme : "default",
);

const entry = computed(() => forTheme(selected.value));
const fileInput = ref<HTMLInputElement | null>(null);
const uploading = ref(false);

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file)
    return;
  uploading.value = true;
  try {
    await gate(() => upload(selected.value, file));
  }
  finally {
    uploading.value = false;
    input.value = "";
  }
}

function removeBg() {
  return gate(() => remove(selected.value));
}
function adjust(patch: { brightness?: number; blur?: number }) {
  return gate(() => setAdjust(selected.value, patch));
}
</script>

<template>
  <div class="space-y-3">
    <div>
      <p class="font-medium text-highlighted">
        Background images
      </p>
      <p class="text-sm text-muted">
        Give a theme its own photo background (shared on every device).
      </p>
    </div>

    <div class="flex items-center gap-2">
      <USelect
        v-model="selected"
        :items="themeOptions"
        value-attribute="value"
        option-attribute="label"
        size="sm"
        class="w-44"
        aria-label="Theme to customize"
      />
    </div>

    <!-- Preview -->
    <div class="relative h-32 overflow-hidden rounded-lg border border-default bg-elevated">
      <img
        v-if="entry"
        :src="urlFor(entry.storedName)"
        alt=""
        class="h-full w-full object-cover"
        :style="{ filter: `brightness(${entry.brightness ?? 1}) blur(${entry.blur ?? 0}px)` }"
      >
      <div v-else class="flex h-full items-center justify-center text-sm text-muted">
        Using the built-in background
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <input
        ref="fileInput"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        class="hidden"
        @change="onFile"
      >
      <UButton
        size="sm"
        icon="i-lucide-upload"
        :loading="uploading"
        :label="entry ? 'Replace image' : 'Upload image'"
        @click="fileInput?.click()"
      />
      <UButton
        v-if="entry"
        size="sm"
        color="error"
        variant="soft"
        icon="i-lucide-trash"
        label="Remove"
        @click="removeBg"
      />
    </div>

    <!-- Brightness + blur (only meaningful when a custom image is set) -->
    <div v-if="entry" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label class="block text-sm">
        <span class="text-muted">Brightness</span>
        <input
          type="range"
          min="0.3"
          max="1.5"
          step="0.05"
          :value="entry.brightness ?? 1"
          class="w-full"
          @change="adjust({ brightness: Number(($event.target as HTMLInputElement).value) })"
        >
      </label>
      <label class="block text-sm">
        <span class="text-muted">Blur</span>
        <input
          type="range"
          min="0"
          max="12"
          step="1"
          :value="entry.blur ?? 0"
          class="w-full"
          @change="adjust({ blur: Number(($event.target as HTMLInputElement).value) })"
        >
      </label>
    </div>
  </div>
</template>
