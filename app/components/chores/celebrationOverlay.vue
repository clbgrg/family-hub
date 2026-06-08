<script setup lang="ts">
import type { NewBadge } from "~/composables/useChores";

const props = defineProps<{
  name: string;
  pointsToday: number;
  streak: number;
  newBadges: NewBadge[];
}>();
const emit = defineEmits<{ (e: "dismiss"): void }>();

let timer: ReturnType<typeof setTimeout> | null = null;

onMounted(async () => {
  // canvas-confetti touches window/canvas — only ever runs client-side (onMounted).
  try {
    const confetti = (await import("canvas-confetti")).default;
    confetti({ particleCount: 140, spread: 100, origin: { y: 0.6 } });
    const end = Date.now() + 1800;
    const frame = () => {
      confetti({ particleCount: 5, angle: 60, spread: 70, origin: { x: 0 } });
      confetti({ particleCount: 5, angle: 120, spread: 70, origin: { x: 1 } });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }
  catch {
    // confetti is best-effort; the celebration still shows without it.
  }
  timer = setTimeout(() => emit("dismiss"), 10000);
});

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer);
});
</script>

<template>
  <div
    class="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-6 bg-black/70 p-6 text-center text-white"
    @click="emit('dismiss')"
  >
    <p class="text-5xl">
      🎉
    </p>
    <h2 class="text-4xl font-bold">
      Amazing work, {{ name }}!
    </h2>
    <p class="text-2xl">
      All chores done
    </p>

    <div class="flex items-center gap-6 text-xl">
      <span>⭐ {{ pointsToday }} points today</span>
      <span v-if="streak > 1">🔥 {{ streak }}-day streak</span>
    </div>

    <div v-if="newBadges.length" class="flex flex-col items-center gap-2">
      <p class="text-lg">
        New badge{{ newBadges.length > 1 ? "s" : "" }} unlocked!
      </p>
      <div class="flex gap-4">
        <div v-for="b in newBadges" :key="b.key" class="flex flex-col items-center gap-1">
          <UIcon :name="b.icon" class="size-10 text-yellow-300" />
          <span class="text-sm">{{ b.label }}</span>
        </div>
      </div>
    </div>

    <p class="text-sm text-white/60">
      Tap anywhere to dismiss
    </p>
  </div>
</template>
