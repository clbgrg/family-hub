<script setup lang="ts">
import { useIdle } from "@vueuse/core";

type Photo = {
  name: string;
  url: string;
};

const { preferences } = useClientPreferences();
const route = useRoute();
const { loggedIn, clear: clearSession } = useUserSession();
// Live timer state — shown over the screensaver so an active "read for 15 min"
// stays visible (and ticking) while the screen is idle.
const { active: timerActive, displayTitle: timerTitle, clock: timerClock } = useTaskTimer();

const enabled = computed(() => preferences.value?.screensaverEnabled !== false);
// useIdle's timeout isn't reactive; read once at setup (changing it takes a reload).
const idleMs = Math.max(1000, (preferences.value?.screensaverIdleMinutes ?? 5) * 60_000);
// Never screensave over the login/setup screens (would cover the PIN pad).
const onAuthScreen = computed(() => ["/login", "/setup"].includes(route.path));

const { idle } = useIdle(idleMs, {
  events: ["mousemove", "mousedown", "keydown", "touchstart", "wheel", "scroll"],
});

const photos = ref<Photo[]>([]);
const photoIdx = ref(0);
const now = ref(new Date());
let clockTimer: ReturnType<typeof setInterval> | null = null;
let photoTimer: ReturnType<typeof setInterval> | null = null;

// Configurable photo rotation cadence; 0 / unset → 30s, null → never rotate.
const rotationMs = computed(() => {
  const secs = preferences.value?.screensaverRotationSeconds ?? 30;
  return secs > 0 ? secs * 1000 : null;
});

const showSaver = computed(() => enabled.value && !onAuthScreen.value && idle.value);

// Wake = lock-screen semantics: the touch that dismisses the screensaver ends
// the session and lands on the profile picker, so the device never resumes as
// the last active user (kids tap back in; parents re-enter their PIN).
watch(showSaver, async (showing, wasShowing) => {
  if (!wasShowing || showing)
    return;
  if (loggedIn.value)
    await clearSession();
  await navigateTo("/login");
});
const currentPhoto = computed(() => photos.value[photoIdx.value]?.url ?? null);
const clock = computed(() =>
  now.value.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
);
const dateStr = computed(() =>
  now.value.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }),
);

function stopPhotoTimer() {
  if (photoTimer) {
    clearInterval(photoTimer);
    photoTimer = null;
  }
}
function startPhotoTimer() {
  stopPhotoTimer();
  const ms = rotationMs.value;
  if (ms == null)
    return; // "Never auto-rotate"
  photoTimer = setInterval(() => {
    if (photos.value.length > 1) {
      photoIdx.value = (photoIdx.value + 1) % photos.value.length;
    }
  }, ms);
}

// Honor interval changes live (no reload needed).
watch(rotationMs, () => startPhotoTimer());

onMounted(async () => {
  try {
    photos.value = await $fetch<Photo[]>("/api/photos");
  }
  catch {
    photos.value = [];
  }
  clockTimer = setInterval(() => {
    now.value = new Date();
  }, 1000);
  startPhotoTimer();
});

onBeforeUnmount(() => {
  if (clockTimer)
    clearInterval(clockTimer);
  stopPhotoTimer();
});
</script>

<template>
  <Transition name="ss-fade">
    <div
      v-if="showSaver"
      data-screensaver
      class="fixed inset-0 z-[300] flex items-center justify-center overflow-hidden bg-black text-white"
    >
      <img
        v-if="currentPhoto"
        :key="currentPhoto"
        :src="currentPhoto"
        alt=""
        class="absolute inset-0 h-full w-full object-cover opacity-80"
      >
      <div class="absolute inset-0 bg-black/30" />
      <div class="relative z-10 text-center drop-shadow-2xl">
        <template v-if="timerActive">
          <p class="text-2xl font-medium sm:text-3xl">
            {{ timerTitle }}
          </p>
          <p class="mt-1 text-8xl font-bold tabular-nums sm:text-9xl">
            {{ timerClock }}
          </p>
          <p class="mt-3 text-xl text-white/80">
            {{ clock }} · {{ dateStr }}
          </p>
        </template>
        <template v-else>
          <p class="text-8xl font-bold tabular-nums sm:text-9xl">
            {{ clock }}
          </p>
          <p class="mt-2 text-2xl sm:text-3xl">
            {{ dateStr }}
          </p>
        </template>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.ss-fade-enter-active,
.ss-fade-leave-active {
  transition: opacity 0.5s ease;
}
.ss-fade-enter-from,
.ss-fade-leave-to {
  opacity: 0;
}
</style>
