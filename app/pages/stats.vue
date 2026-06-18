<script setup lang="ts">
import { recurrenceLabel } from "~/composables/useChores";

const { user } = useUserSession();
const isAdmin = computed(() => user.value?.role === "ADMIN");
const { gate } = useAdminGate();
const { updateChore, today } = useChores();
const { analytics, refresh } = useAnalytics(today);
const { pointsLabel } = useFamilyConfig();

const maxUser = computed(() => Math.max(1, ...analytics.value.perUser.map(u => u.completions)));

// One-tap "up the points to get it done" — admin-gated, reuses the chore PUT.
async function boost(choreId: string, points: number) {
  await gate(() => updateChore(choreId, { points: points + 5 }));
  await refresh();
}

function areaLabel(a: { name: string; icon: string | null }) {
  return a.icon && !a.icon.startsWith("i-") ? `${a.icon} ${a.name}` : a.name;
}
</script>

<template>
  <div class="flex w-full flex-col">
    <div class="sticky top-0 z-40 border-b border-default bg-default px-4 py-5">
      <h1 class="text-2xl font-bold">
        Stats
      </h1>
      <p class="text-muted">
        Last {{ analytics.windowDays }} days
      </p>
    </div>

    <ClientOnly>
      <div class="grid gap-4 p-4 sm:grid-cols-2">
        <UCard>
          <template #header>
            <h2 class="font-semibold">
              🏆 Most chores done
            </h2>
          </template>
          <div v-if="analytics.perUser.some(u => u.completions > 0)" class="flex flex-col gap-2">
            <div
              v-for="u in analytics.perUser"
              :key="u.userId"
              class="flex items-center gap-3"
            >
              <UAvatar
                :src="u.avatar || undefined"
                :alt="u.name"
                size="xs"
              />
              <span class="w-20 shrink-0 truncate text-sm font-medium">{{ u.name }}</span>
              <div class="h-2 flex-1 overflow-hidden rounded-full bg-elevated">
                <div class="h-full rounded-full bg-primary" :style="{ width: `${(u.completions / maxUser) * 100}%` }" />
              </div>
              <span class="w-28 shrink-0 text-right text-xs text-muted">{{ u.completions }} done · {{ u.points }} {{ pointsLabel }}</span>
            </div>
          </div>
          <p v-else class="text-sm text-muted">
            No completions yet.
          </p>
        </UCard>

        <UCard>
          <template #header>
            <h2 class="font-semibold">
              By area
            </h2>
          </template>
          <div v-if="analytics.byArea.length" class="flex flex-col gap-2">
            <div
              v-for="a in analytics.byArea"
              :key="a.areaId ?? '__none__'"
              class="flex items-center justify-between text-sm"
            >
              <span>{{ areaLabel(a) }}</span>
              <span class="text-muted">{{ a.completions }}</span>
            </div>
          </div>
          <p v-else class="text-sm text-muted">
            No completions yet.
          </p>
        </UCard>

        <UCard class="sm:col-span-2">
          <template #header>
            <h2 class="font-semibold">
              Needs attention — least done
            </h2>
          </template>
          <ul v-if="analytics.neglected.length" class="flex flex-col gap-2">
            <li
              v-for="c in analytics.neglected"
              :key="c.choreId"
              class="flex items-center gap-3 rounded-lg border border-default p-3"
            >
              <span v-if="c.area?.icon && !c.area.icon.startsWith('i-')" class="text-lg">{{ c.area.icon }}</span>
              <div class="min-w-0 flex-1">
                <p class="truncate font-medium">
                  {{ c.title }}
                </p>
                <p class="text-xs text-muted">
                  {{ recurrenceLabel(c) }} · {{ c.completions }}× in {{ analytics.windowDays }}d · {{ c.points }} {{ pointsLabel }}
                </p>
              </div>
              <UButton
                v-if="isAdmin"
                size="xs"
                icon="i-lucide-trending-up"
                @click="boost(c.choreId, c.points)"
              >
                Boost +5
              </UButton>
            </li>
          </ul>
          <p v-else class="text-sm text-muted">
            No recurring chores yet.
          </p>
        </UCard>
      </div>
      <template #fallback>
        <div class="p-4 text-muted">
          Loading…
        </div>
      </template>
    </ClientOnly>
  </div>
</template>
