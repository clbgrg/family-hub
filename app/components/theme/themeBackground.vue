<script setup lang="ts">
// Fixed, full-viewport immersive background for the active theme. Purely
// CSS-driven: each `[data-theme]` sets `--theme-bg-image` (gradient + bundled
// SVG art) in main.css, and `.theme-bg` paints it behind the app (z-index -1)
// with a readability scrim baked in. SSR-rendered, so there's no flash; a
// no-op (transparent) on the default theme. Decorative only — aria-hidden.
</script>

<template>
  <div class="theme-bg" aria-hidden="true" />
</template>
