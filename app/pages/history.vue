<script setup lang="ts">
import { formatDistanceToNow } from "date-fns";

const { user } = useUserSession();
const isAdmin = computed(() => user.value?.role === "ADMIN");
const today = isoToday();
const { pointsLabel } = useFamilyConfig();

const requestFetch = useRequestFetch();
const { data: users } = await useAsyncData(
  "history-users",
  () => requestFetch<{ id: string; name: string }[]>("/api/users"),
  { default: () => [], server: false },
);

// "" = everyone (admins). A MEMBER is scoped to themselves server-side.
const selectedUserId = ref("");
const { events } = useHistory(selectedUserId);

const userOptions = computed(() => [
  { label: "Everyone", value: "" },
  ...(users.value ?? []).map(u => ({ label: u.name, value: u.id })),
]);

// Icon + accent per event type (colors limited to the app's safe tokens).
const TYPE_META: Record<string, { icon: string; color: string }> = {
  CHORE_COMPLETED: { icon: "i-lucide-circle-check", color: "text-primary" },
  SCHOOL_COMPLETED: { icon: "i-lucide-graduation-cap", color: "text-primary" },
  REDEMPTION_APPROVED: { icon: "i-lucide-gift", color: "text-primary" },
  REDEMPTION_REJECTED: { icon: "i-lucide-x-circle", color: "text-error" },
  POINTS_ADJUSTED: { icon: "i-lucide-coins", color: "text-muted" },
  MESSAGE_POSTED: { icon: "i-lucide-sticky-note", color: "text-muted" },
  BADGE_EARNED: { icon: "i-lucide-award", color: "text-primary" },
};
function meta(type: string) {
  return TYPE_META[type] ?? { icon: "i-lucide-dot", color: "text-muted" };
}
function timeAgo(ts: string) {
  return formatDistanceToNow(new Date(ts), { addSuffix: true });
}
</script>

<template>
  <div class="flex w-full flex-col">
    <div class="sticky top-0 z-40 flex items-center justify-between gap-4 border-b border-default bg-default px-4 py-5">
      <h1 class="text-2xl font-bold">
        History
      </h1>
      <USelect
        v-if="isAdmin"
        v-model="selectedUserId"
        :items="userOptions"
        option-attribute="label"
        value-attribute="value"
        class="w-44"
        :ui="{ base: 'w-full' }"
      />
    </div>

    <ClientOnly>
      <div class="p-4 pb-0">
        <PointsLineChart
          :user-id="selectedUserId"
          :date="today"
          :points-label="pointsLabel"
        />
      </div>
      <div v-if="events.length" class="flex flex-col gap-1 p-4">
        <div
          v-for="e in events"
          :key="e.id"
          class="flex items-center gap-3 rounded-lg p-2 hover:bg-elevated"
        >
          <UIcon
            :name="meta(e.type).icon"
            class="size-5 shrink-0"
            :class="meta(e.type).color"
          />
          <UAvatar
            v-if="e.actor"
            :src="e.actor.avatar || undefined"
            :alt="e.actor.name"
            size="xs"
          />
          <p class="min-w-0 flex-1 truncate text-sm">
            <span v-if="e.actor" class="font-medium">{{ e.actor.name }}</span>
            {{ e.summary }}
          </p>
          <span class="shrink-0 text-xs text-muted">{{ timeAgo(e.timestamp) }}</span>
        </div>
      </div>
      <p v-else class="p-8 text-center text-muted">
        No activity yet.
      </p>
      <template #fallback>
        <div class="p-4 text-muted">
          Loading…
        </div>
      </template>
    </ClientOnly>
  </div>
</template>
