<script setup lang="ts">
import { useIdle } from "@vueuse/core";

type Photo = {
  name: string;
  url: string;
};

const { preferences } = useClientPreferences();
const route = useRoute();

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

const showSaver = computed(() => enabled.value && !onAuthScreen.value && idle.value);
const currentPhoto = computed(() => photos.value[photoIdx.value]?.url ?? null);
const clock = computed(() =>
  now.value.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
);
const dateStr = computed(() =>
  now.value.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }),
);

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
  photoTimer = setInterval(() => {
    if (photos.value.length > 1) {
      photoIdx.value = (photoIdx.value + 1) % photos.value.length;
    }
  }, 8000);
});

onBeforeUnmount(() => {
  if (clockTimer)
    clearInterval(clockTimer);
  if (photoTimer)
    clearInterval(photoTimer);
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
        <p class="text-8xl font-bold tabular-nums sm:text-9xl">
          {{ clock }}
        </p>
        <p class="mt-2 text-2xl sm:text-3xl">
          {{ dateStr }}
        </p>
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
