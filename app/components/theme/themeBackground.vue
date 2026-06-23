<script setup lang="ts">
// Fixed, full-viewport immersive background for the active theme.
// Default: CSS-driven via [data-theme]'s --theme-bg-image (bundled SVG art),
// painted by `.theme-bg` behind the app (z-index -1). If the active theme has a
// custom uploaded background, paint that instead (per-theme brightness/blur)
// over a readability scrim. The `theme` prop comes from app.vue's useTheme() so
// this component doesn't re-run that composable. Decorative only — aria-hidden.
const props = defineProps<{ theme?: string }>();
const { forTheme, urlFor } = useThemeBackgrounds();

const custom = computed(() => forTheme(props.theme));
const customStyle = computed(() => {
  const c = custom.value;
  if (!c)
    return undefined;
  return {
    backgroundImage: `url("${urlFor(c.storedName)}")`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    filter: `brightness(${c.brightness ?? 1}) blur(${c.blur ?? 0}px)`,
  };
});
</script>

<template>
  <div
    class="theme-bg"
    aria-hidden="true"
    :style="customStyle"
  />
  <div
    v-if="custom"
    class="theme-bg-scrim"
    aria-hidden="true"
  />
</template>
