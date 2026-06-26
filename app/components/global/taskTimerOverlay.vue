<script setup lang="ts">
import type { CompleteResult, NewBadge } from "~/composables/useChores";
import type { SchoolCompleteResult } from "~/composables/useSchoolItems";

import CelebrationOverlay from "~/components/chores/celebrationOverlay.vue";

// Live countdown state + actions now live in the composable so the screensaver
// can read them and the ticker survives the overlay being hidden. The overlay
// keeps only completion/celebration concerns.
const { task, phase, minutes, remainingMs, clock, displayTitle, start, resume, pause, stopTick, closeTimer } = useTaskTimer();
const toast = useToast();

const PRESETS = [5, 10, 15, 20, 30];

const completing = ref(false);
const celebration = ref<{ name: string; pointsToday: number; streak: number; newBadges: NewBadge[] } | null>(null);

// Reset transient local state whenever a new timer is launched.
watch(task, () => {
  celebration.value = null;
  completing.value = false;
});

// The composable's ticker flips phase to "finishing" at zero — run completion.
watch(phase, (p) => {
  if (p === "finishing") {
    complete();
  }
});

function cancel() {
  closeTimer();
}

const progress = computed(() => {
  const total = minutes.value * 60_000;
  return total > 0 ? 1 - remainingMs.value / total : 1;
});

async function complete() {
  const t = task.value;
  if (!t || completing.value)
    return;
  completing.value = true;
  stopTick();
  // A free timer isn't tied to anything to complete — just celebrate the win.
  if (t.kind === "free") {
    try {
      const confetti = (await import("canvas-confetti")).default;
      confetti({ particleCount: 90, spread: 80, origin: { y: 0.7 } });
    }
    catch {
      // best-effort
    }
    toast.add({ title: "Time's up! ⏰", color: "success" });
    closeTimer();
    return;
  }
  try {
    const localDate = isoToday();
    if (t.kind === "chore") {
      const result = await $fetch<CompleteResult>(`/api/chores/${t.id}/complete`, {
        method: "POST",
        body: { localDate, userId: t.userId },
      });
      await refreshNuxtData();
      if (result.allDoneToday) {
        // The celebration replaces the timer UI; dismissing it closes everything.
        celebration.value = {
          name: t.assigneeName,
          pointsToday: result.pointsToday,
          streak: result.streak,
          newBadges: result.newBadges,
        };
        return;
      }
      for (const b of result.newBadges) {
        toast.add({ title: `New badge: ${b.label}!`, icon: b.icon, color: "primary" });
      }
    }
    else {
      const result = await $fetch<SchoolCompleteResult>(`/api/school-items/${t.id}/complete`, {
        method: "POST",
        body: { localDate },
      });
      await refreshNuxtData();
      for (const b of result.newBadges) {
        toast.add({ title: `New badge: ${b.label}!`, icon: b.icon, color: "primary" });
      }
    }
    // A small win moment even without the full all-done celebration.
    try {
      const confetti = (await import("canvas-confetti")).default;
      confetti({ particleCount: 90, spread: 80, origin: { y: 0.7 } });
    }
    catch {
      // best-effort
    }
    toast.add({ title: "Time's up — task done! ✅", color: "success" });
    closeTimer();
  }
  catch {
    toast.add({ title: "Couldn't mark the task done", description: "Check it off by hand on the board.", color: "error" });
    closeTimer();
  }
}

onBeforeUnmount(stopTick);
</script>

<template>
  <!-- Celebration takes over when the timed task finished the whole day. -->
  <CelebrationOverlay
    v-if="celebration && task"
    :name="celebration.name"
    :points-today="celebration.pointsToday"
    :streak="celebration.streak"
    :new-badges="celebration.newBadges"
    @dismiss="celebration = null; closeTimer()"
  />

  <div
    v-else-if="task"
    class="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-4"
  >
    <div class="flex w-full max-w-sm flex-col items-center gap-5 rounded-2xl border border-default bg-default p-6 text-center shadow-xl">
      <div class="flex w-full items-start justify-between gap-2">
        <div class="min-w-0 text-left">
          <p class="text-xs uppercase tracking-wide text-muted">
            {{ task.kind === "free" ? "Timer" : "Task timer" }}
          </p>
          <h3 class="truncate text-lg font-semibold">
            {{ displayTitle }}
          </h3>
        </div>
        <UButton
          icon="i-lucide-x"
          variant="ghost"
          color="neutral"
          aria-label="Close timer"
          @click="cancel"
        />
      </div>

      <!-- Step 1: pick a duration -->
      <template v-if="phase === 'pick'">
        <div class="flex flex-wrap justify-center gap-2">
          <UButton
            v-for="p in PRESETS"
            :key="p"
            :label="`${p} min`"
            size="lg"
            :variant="minutes === p ? 'solid' : 'outline'"
            :color="minutes === p ? 'primary' : 'neutral'"
            @click="minutes = p"
          />
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm text-muted">or</span>
          <UInput
            v-model.number="minutes"
            type="number"
            :min="1"
            :max="180"
            class="w-20"
          />
          <span class="text-sm text-muted">minutes</span>
        </div>
        <UButton
          icon="i-lucide-play"
          label="Start"
          size="xl"
          class="w-full justify-center"
          @click="start"
        />
      </template>

      <!-- Step 2: countdown -->
      <template v-else>
        <p class="text-7xl font-bold tabular-nums">
          {{ clock }}
        </p>
        <div class="h-2 w-full overflow-hidden rounded-full bg-elevated">
          <div
            class="h-full rounded-full bg-primary transition-[width] duration-300"
            :style="{ width: `${Math.round(progress * 100)}%` }"
          />
        </div>
        <div class="flex w-full gap-2">
          <UButton
            v-if="phase === 'running'"
            icon="i-lucide-pause"
            label="Pause"
            variant="soft"
            color="neutral"
            class="flex-1 justify-center"
            @click="pause"
          />
          <UButton
            v-else-if="phase === 'paused'"
            icon="i-lucide-play"
            label="Resume"
            variant="soft"
            class="flex-1 justify-center"
            @click="resume"
          />
          <UButton
            icon="i-lucide-check"
            label="Finish now"
            :loading="completing"
            class="flex-1 justify-center"
            @click="complete"
          />
        </div>
      </template>
    </div>
  </div>
</template>
