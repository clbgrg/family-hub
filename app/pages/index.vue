<script setup lang="ts">
import type { ChoreBoardItem } from "~/composables/useChores";
import type { Meal, MealSlot } from "~/composables/useMeals";

interface DashUser { id: string; name: string; avatar: string | null; color: string | null }
interface DashEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  color: string | null;
}

const requestFetch = useRequestFetch();
const today = isoToday();

const { data: chores } = await useAsyncData(
  "dash-chores",
  () => requestFetch<ChoreBoardItem[]>("/api/chores", { query: { date: today } }),
  { default: () => [], server: false },
);
const { data: meals } = await useAsyncData(
  "dash-meals",
  () => requestFetch<Meal[]>("/api/meals", { query: { start: today, end: today } }),
  { default: () => [], server: false },
);
const { data: events } = await useAsyncData(
  "dash-events",
  () => requestFetch<DashEvent[]>("/api/calendar-events"),
  { default: () => [], server: false },
);
const { data: users } = await useAsyncData(
  "dash-users",
  () => requestFetch<DashUser[]>("/api/users"),
  { default: () => [], server: false },
);

// Per-member chores due today (only members who have any).
const board = computed(() => {
  const due = (chores.value ?? []).filter(c => c.dueToday);
  return (users.value ?? [])
    .map(u => ({ user: u, chores: due.filter(c => c.assignee?.id === u.id) }))
    .filter(g => g.chores.length > 0);
});

// Events overlapping today, earliest first.
const todayEvents = computed(() => {
  const start = new Date(`${today}T00:00:00`);
  const end = new Date(`${today}T23:59:59`);
  return (events.value ?? [])
    .filter((e) => {
      const s = new Date(e.start);
      const en = new Date(e.end);
      return s <= end && en >= start;
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
});

const mealBySlot = computed(() => {
  const map: Record<string, Meal> = {};
  for (const m of meals.value ?? []) map[m.slot] = m;
  return map;
});
const slots: { key: MealSlot; label: string }[] = [
  { key: "BREAKFAST", label: "Breakfast" },
  { key: "LUNCH", label: "Lunch" },
  { key: "DINNER", label: "Dinner" },
];

function eventTime(e: DashEvent) {
  if (e.allDay) return "All day";
  return new Date(e.start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
const longDate = new Date(`${today}T00:00:00`).toLocaleDateString(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
});
</script>

<template>
  <div class="flex w-full flex-col">
    <div class="sticky top-0 z-40 border-b border-default bg-default py-5 sm:px-4">
      <h1 class="text-2xl font-bold">
        Today
      </h1>
      <p class="text-muted">
        {{ longDate }}
      </p>
    </div>

    <ClientOnly>
      <div class="grid gap-4 p-4 lg:grid-cols-3">
        <!-- Chores (per member) -->
        <UCard class="lg:col-span-2">
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-list-checks" class="size-5 text-primary" />
              <h2 class="text-lg font-semibold">
                Today's chores
              </h2>
            </div>
          </template>
          <div v-if="board.length" class="grid gap-4 sm:grid-cols-2">
            <div v-for="group in board" :key="group.user.id">
              <div class="mb-1 flex items-center gap-2">
                <UAvatar :src="group.user.avatar || undefined" :alt="group.user.name" size="2xs" />
                <span class="font-medium">{{ group.user.name }}</span>
              </div>
              <ul class="flex flex-col gap-1">
                <li
                  v-for="chore in group.chores"
                  :key="chore.id"
                  class="flex items-center gap-2 text-sm"
                  :class="chore.done ? 'text-muted line-through' : ''"
                >
                  <UIcon :name="chore.done ? 'i-lucide-check-circle-2' : 'i-lucide-circle'" class="size-4 shrink-0" :class="chore.done ? 'text-primary' : 'text-muted'" />
                  <span class="truncate">{{ chore.title }}</span>
                  <span class="ml-auto shrink-0 text-xs text-muted">+{{ chore.points }}</span>
                </li>
              </ul>
            </div>
          </div>
          <p v-else class="py-6 text-center text-muted">
            No chores due today 🎉
          </p>
          <template #footer>
            <UButton to="/chores" label="Open chore board" variant="ghost" color="neutral" size="sm" trailing-icon="i-lucide-arrow-right" />
          </template>
        </UCard>

        <div class="flex flex-col gap-4">
          <!-- Calendar -->
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-calendar-days" class="size-5 text-primary" />
                <h2 class="text-lg font-semibold">
                  Today's calendar
                </h2>
              </div>
            </template>
            <ul v-if="todayEvents.length" class="flex flex-col gap-2">
              <li v-for="e in todayEvents" :key="e.id" class="flex items-start gap-2">
                <span class="mt-1.5 size-2 shrink-0 rounded-full" :style="{ backgroundColor: e.color || '#6b7280' }" />
                <div class="min-w-0">
                  <p class="truncate font-medium">
                    {{ e.title }}
                  </p>
                  <p class="text-xs text-muted">
                    {{ eventTime(e) }}
                  </p>
                </div>
              </li>
            </ul>
            <p v-else class="py-4 text-center text-sm text-muted">
              Nothing on the calendar today.
            </p>
          </UCard>

          <!-- Meals -->
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-utensils" class="size-5 text-primary" />
                <h2 class="text-lg font-semibold">
                  Today's meals
                </h2>
              </div>
            </template>
            <ul class="flex flex-col gap-2">
              <li v-for="s in slots" :key="s.key" class="flex items-baseline justify-between gap-3">
                <span class="text-sm text-muted">{{ s.label }}</span>
                <span class="truncate text-right font-medium">
                  {{ mealBySlot[s.key]?.title || "—" }}
                </span>
              </li>
            </ul>
            <template #footer>
              <UButton to="/mealPlanner" label="Open meal planner" variant="ghost" color="neutral" size="sm" trailing-icon="i-lucide-arrow-right" />
            </template>
          </UCard>
        </div>
      </div>
      <template #fallback>
        <div class="p-4 text-muted">
          Loading today…
        </div>
      </template>
    </ClientOnly>
  </div>
</template>
