<script setup lang="ts">
import type { ThemeName } from "~/types/ui";

import { THEME_MOTIFS } from "~/utils/themeMotifs";

const props = defineProps<{ theme: ThemeName; enabled: boolean }>();

// Respect the OS "reduce motion" setting — no ambient animation for those users.
const reducedMotion = ref(false);
onMounted(() => {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  reducedMotion.value = mq.matches;
  mq.addEventListener?.("change", e => (reducedMotion.value = e.matches));
});

const motif = computed(() => THEME_MOTIFS[props.theme]);
const active = computed(() => props.enabled && !reducedMotion.value && !!motif.value);

// A sparse, fixed set of drifting particles. Few elements + transform/opacity-only
// animation keeps this cheap enough for the Raspberry Pi. Regenerated only when
// the theme changes (client-only, so Math.random is fine).
const COUNT = 16;
const particles = computed(() => {
  const m = motif.value;
  if (!m)
    return [];
  const twinkle = m.motion === "twinkle";
  return Array.from({ length: COUNT }, (_, i) => ({
    emoji: m.emojis[i % m.emojis.length]!,
    left: Math.round(Math.random() * 100),
    top: twinkle ? Math.round(Math.random() * 92) : 0,
    size: 14 + Math.round(Math.random() * 16),
    delay: +(Math.random() * (twinkle ? 4 : 14)).toFixed(2),
    duration: twinkle ? 3 + Math.round(Math.random() * 4) : 9 + Math.round(Math.random() * 12),
    drift: twinkle ? Math.round(Math.random() * 12 - 6) : Math.round(Math.random() * 60 - 30),
  }));
});
</script>

<template>
  <div
    v-if="active"
    class="theme-decor"
    :data-motion="motif?.motion"
    aria-hidden="true"
  >
    <span
      v-for="(p, i) in particles"
      :key="i"
      class="theme-decor__p"
      :style="{
        'left': `${p.left}%`,
        'top': `${p.top}%`,
        'fontSize': `${p.size}px`,
        'animationDelay': `${p.delay}s`,
        'animationDuration': `${p.duration}s`,
        '--drift': `${p.drift}px`,
      }"
    >{{ p.emoji }}</span>
  </div>
</template>

<style scoped>
.theme-decor {
  position: fixed;
  inset: 0;
  z-index: 20;
  overflow: hidden;
  pointer-events: none;
}

.theme-decor__p {
  position: absolute;
  opacity: 0.85;
  will-change: transform, opacity;
  animation-iteration-count: infinite;
  animation-timing-function: linear;
}

.theme-decor[data-motion="fall"] .theme-decor__p {
  top: 0;
  animation-name: decor-fall;
}
.theme-decor[data-motion="rise"] .theme-decor__p {
  top: 0;
  animation-name: decor-rise;
}
.theme-decor[data-motion="float"] .theme-decor__p {
  top: 0;
  animation-name: decor-float;
  animation-timing-function: ease-in-out;
}
.theme-decor[data-motion="twinkle"] .theme-decor__p {
  animation-name: decor-twinkle;
  animation-timing-function: ease-in-out;
}

@keyframes decor-fall {
  0% {
    transform: translate(0, -12vh) rotate(0deg);
    opacity: 0;
  }
  8% {
    opacity: 0.9;
  }
  100% {
    transform: translate(var(--drift), 112vh) rotate(360deg);
    opacity: 0.9;
  }
}
@keyframes decor-rise {
  0% {
    transform: translate(0, 112vh);
    opacity: 0;
  }
  8% {
    opacity: 0.9;
  }
  100% {
    transform: translate(var(--drift), -12vh);
    opacity: 0.9;
  }
}
@keyframes decor-float {
  0% {
    transform: translate(0, 112vh);
    opacity: 0;
  }
  8% {
    opacity: 0.85;
  }
  50% {
    transform: translate(var(--drift), 50vh);
  }
  92% {
    opacity: 0.85;
  }
  100% {
    transform: translate(0, -12vh);
    opacity: 0;
  }
}
@keyframes decor-twinkle {
  0%,
  100% {
    opacity: 0.15;
    transform: translateY(0) scale(0.85);
  }
  50% {
    opacity: 1;
    transform: translateY(var(--drift)) scale(1.15);
  }
}
</style>
