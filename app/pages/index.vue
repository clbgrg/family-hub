<script setup lang="ts">
import type { ChoreBoardItem, NewBadge } from "~/composables/useChores";
import type { Meal, MealSlot } from "~/composables/useMeals";
import type { SchoolItem } from "~/composables/useSchoolItems";

type DashUser = { id: string; name: string; avatar: string | null; color: string | null };
type DashEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  color: string | null;
};

const { user } = useUserSession();
const isAdmin = computed(() => user.value?.role === "ADMIN");
const requestFetch = useRequestFetch();
const today = isoToday();

// Shared asyncData keys with the chores page, so a check-off here refreshes
// the board there (and vice versa) — plus interactive setDone + celebration.
const { chores, statsByUser, setDone } = useChores();
const weekStart = ref(weekStartMonday(today));
const { itemsByUser: schoolItemsByUser, setDone: setSchoolDone } = useSchoolItems(weekStart);
const toast = useToast();

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
const { data: schoolNotes } = await useAsyncData(
  "dash-school",
  () => requestFetch<{ userId: string; date: string; text: string }[]>("/api/school-notes", { query: { start: today, end: today } }),
  { default: () => [], server: false },
);

const schoolByUser = computed(() => {
  const map: Record<string, string> = {};
  for (const n of schoolNotes.value ?? []) map[n.userId] = n.text;
  return map;
});

// School items worth surfacing today: not done yet (overdue or upcoming
// within the visible week) or completed today (so the check stays visible).
function dashSchoolItems(userId: string): SchoolItem[] {
  return (schoolItemsByUser.value[userId] ?? []).filter(i => !i.done || i.dueDate >= today);
}

// Per-member chores due today + school items + today's school note.
const board = computed(() => {
  const due = (chores.value ?? []).filter(c => c.dueToday);
  return (users.value ?? [])
    .map(u => ({
      user: u,
      stats: statsByUser.value[u.id],
      chores: due.filter(c => c.assignee?.id === u.id),
      schoolItems: dashSchoolItems(u.id),
      school: schoolByUser.value[u.id] ?? "",
    }))
    .filter(g => g.chores.length > 0 || g.schoolItems.length > 0 || g.school);
});

const celebration = ref<{ name: string; pointsToday: number; streak: number; newBadges: NewBadge[] } | null>(null);

function canToggle(assigneeId: string | undefined) {
  return isAdmin.value || user.value?.id === assigneeId;
}
async function toggleChore(chore: ChoreBoardItem) {
  if (!canToggle(chore.assignee?.id) || !chore.assignee)
    return;
  const result = await setDone(chore.id, !chore.done, chore.assignee.id);
  if (result?.allDoneToday) {
    celebration.value = {
      name: chore.assignee.name,
      pointsToday: result.pointsToday,
      streak: result.streak,
      newBadges: result.newBadges,
    };
  }
}
async function toggleSchoolItem(item: SchoolItem) {
  if (!canToggle(item.userId))
    return;
  const result = await setSchoolDone(item.id, !item.done);
  for (const b of result?.newBadges ?? []) {
    toast.add({ title: `New badge: ${b.label}!`, icon: b.icon, color: "primary" });
  }
}
function schoolDueLabel(item: SchoolItem) {
  if (item.dueDate < today)
    return "overdue";
  if (item.dueDate === today)
    return "due today";
  return `due ${dayLabel(item.dueDate)}`;
}

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
  if (e.allDay)
    return "All day";
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
        <!-- Chores + school (per member, interactive) -->
        <UCard class="lg:col-span-2">
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-list-checks" class="size-5 text-primary" />
              <h2 class="text-lg font-semibold">
                Today's chores &amp; school
              </h2>
            </div>
          </template>
          <div v-if="board.length" class="grid gap-4 sm:grid-cols-2">
            <div v-for="group in board" :key="group.user.id">
              <div class="mb-1 flex items-center gap-2">
                <UAvatar
                  :src="group.user.avatar || undefined"
                  :alt="group.user.name"
                  size="2xs"
                />
                <span class="font-medium">{{ group.user.name }}</span>
                <span v-if="(group.stats?.streak ?? 0) > 0" class="text-xs text-muted">🔥 {{ group.stats!.streak }}</span>
                <UBadge
                  color="primary"
                  variant="subtle"
                  size="sm"
                  class="ml-auto"
                >
                  {{ group.stats?.pointsTotal ?? 0 }} pts
                </UBadge>
              </div>
              <ul class="flex flex-col gap-1">
                <li
                  v-for="chore in group.chores"
                  :key="`${chore.id}:${group.user.id}`"
                  class="flex items-center gap-2 text-sm"
                  :class="chore.done ? 'text-muted' : ''"
                >
                  <UCheckbox
                    :model-value="chore.done"
                    :disabled="!canToggle(chore.assignee?.id)"
                    @update:model-value="toggleChore(chore)"
                  />
                  <span class="truncate" :class="chore.done ? 'line-through' : ''">{{ chore.title }}</span>
                  <span class="ml-auto shrink-0 text-xs text-muted">+{{ chore.points }}</span>
                </li>
                <li
                  v-for="item in group.schoolItems"
                  :key="item.id"
                  class="flex items-center gap-2 text-sm"
                  :class="item.done ? 'text-muted' : ''"
                >
                  <UCheckbox
                    :model-value="item.done"
                    :disabled="!canToggle(item.userId)"
                    @update:model-value="toggleSchoolItem(item)"
                  />
                  <UIcon name="i-lucide-graduation-cap" class="size-3.5 shrink-0 text-primary" />
                  <span class="truncate" :class="item.done ? 'line-through' : ''">{{ item.title }}</span>
                  <span
                    class="ml-auto shrink-0 text-xs"
                    :class="!item.done && item.dueDate < today ? 'font-medium text-error' : 'text-muted'"
                  >
                    {{ schoolDueLabel(item) }}<template v-if="item.points > 0"> · +{{ item.points }}</template>
                  </span>
                </li>
              </ul>
              <p v-if="group.school" class="mt-1 flex items-start gap-1.5 text-sm">
                <UIcon name="i-lucide-graduation-cap" class="mt-0.5 size-4 shrink-0 text-primary" />
                <span class="whitespace-pre-wrap">{{ group.school }}</span>
              </p>
            </div>
          </div>
          <p v-else class="py-6 text-center text-muted">
            No chores due today 🎉
          </p>
          <template #footer>
            <div class="flex items-center gap-2">
              <UButton
                to="/chores"
                label="Open chore board"
                variant="ghost"
                color="neutral"
                size="sm"
                trailing-icon="i-lucide-arrow-right"
              />
              <UButton
                to="/school"
                label="Open school"
                variant="ghost"
                color="neutral"
                size="sm"
                trailing-icon="i-lucide-arrow-right"
              />
            </div>
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
              <li
                v-for="e in todayEvents"
                :key="e.id"
                class="flex items-start gap-2"
              >
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
              <li
                v-for="s in slots"
                :key="s.key"
                class="flex items-baseline justify-between gap-3"
              >
                <span class="text-sm text-muted">{{ s.label }}</span>
                <span class="truncate text-right font-medium">
                  {{ mealBySlot[s.key]?.title || "—" }}
                </span>
              </li>
            </ul>
            <template #footer>
              <UButton
                to="/mealPlanner"
                label="Open meal planner"
                variant="ghost"
                color="neutral"
                size="sm"
                trailing-icon="i-lucide-arrow-right"
              />
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

    <CelebrationOverlay
      v-if="celebration"
      :name="celebration.name"
      :points-today="celebration.pointsToday"
      :streak="celebration.streak"
      :new-badges="celebration.newBadges"
      @dismiss="celebration = null"
    />
  </div>
</template>
