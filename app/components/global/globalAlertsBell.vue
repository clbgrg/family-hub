<script setup lang="ts">
// Sidebar notification bell: a badge + popover panel of current in-app alerts
// (event reminders, reward approvals). Only shown when the device's
// notifications preference is on; refreshed on navigation + a slow poll.
const { alerts, count, enabled, refresh } = useAlerts();
const route = useRoute();
watch(() => route.path, () => refresh());

let timer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  timer = setInterval(refresh, 60_000);
});
onBeforeUnmount(() => {
  if (timer)
    clearInterval(timer);
});
</script>

<template>
  <ClientOnly>
    <div v-if="enabled" class="relative">
      <UPopover>
        <UButton
          variant="ghost"
          icon="i-lucide-bell"
          size="xl"
          class="text-default"
          aria-label="Notifications"
        />
        <template #content>
          <div class="max-h-96 w-72 overflow-y-auto p-2">
            <p class="px-2 py-1 text-sm font-semibold">
              Notifications
            </p>
            <ul v-if="alerts.length" class="flex flex-col">
              <li
                v-for="a in alerts"
                :key="a.id"
                class="flex items-start gap-2 rounded-md px-2 py-2 hover:bg-elevated"
              >
                <UIcon :name="a.icon" class="mt-0.5 size-4 shrink-0 text-primary" />
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium">
                    {{ a.title }}
                  </p>
                  <p v-if="a.body" class="truncate text-xs text-muted">
                    {{ a.body }}
                  </p>
                </div>
              </li>
            </ul>
            <p v-else class="px-2 py-3 text-sm text-muted">
              You're all caught up 🎉
            </p>
          </div>
        </template>
      </UPopover>
      <span
        v-if="count > 0"
        class="pointer-events-none absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold text-white"
      >
        {{ count > 9 ? "9+" : count }}
      </span>
    </div>
  </ClientOnly>
</template>
