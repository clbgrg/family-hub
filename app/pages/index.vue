<script setup lang="ts">
import type { ChoreBoardItem, NewBadge } from "~/composables/useChores";
import type { Meal, MealSlot } from "~/composables/useMeals";
import type { SchoolItem } from "~/composables/useSchoolItems";
import type { ThemeName } from "~/types/ui";

import { groupChoresByArea, recurrenceLabel, sortMeFirst } from "~/composables/useChores";
import { THEME_OPTIONS } from "~/types/ui";

type DashUser = { id: string; name: string; avatar: string | null; color: string | null };
type DashEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  color: string | string[] | null;
  users?: { id: string }[];
};

const { user } = useUserSession();
const isAdmin = computed(() => user.value?.role === "ADMIN");
const requestFetch = useRequestFetch();
const today = isoToday();
const { count: unreadNotes } = useUnreadMessages();
const { startTimerFor } = useTaskTimer();

// Quick theme switcher in the dashboard header (full control also in Settings → Appearance).
const { preferences, updatePreferences } = useClientPreferences();
const selectedTheme = computed({
  get: () => preferences.value?.theme ?? "default",
  set: (v: ThemeName) => updatePreferences({ theme: v }),
});

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

// Events on nobody's column belong to the whole family (top strip).
const familyEvents = computed(() => todayEvents.value.filter(e => !(e.users?.length)));
function eventsFor(userId: string): DashEvent[] {
  return todayEvents.value.filter(e => e.users?.some(u => u.id === userId));
}

// One column per family member — a personal to-do list of their day. The
// auto-fit grid keeps columns side by side while they fit and wraps/stacks
// them when the screen gets tight.
const columns = computed(() => {
  const cols = (users.value ?? []).map((u) => {
    const userChores = (chores.value ?? []).filter(c => c.dueToday && c.assignee?.id === u.id);
    return {
      user: u,
      stats: statsByUser.value[u.id],
      events: eventsFor(u.id),
      chores: userChores,
      choreGroups: groupChoresByArea(userChores),
      schoolItems: dashSchoolItems(u.id),
      school: schoolByUser.value[u.id] ?? "",
    };
  });
  return sortMeFirst(cols, user.value?.id);
});

// Tap a column header to fold it into its accordion header (handy when a
// column runs long on the kiosk).
const collapsed = ref(new Set<string>());
function toggleCollapsed(userId: string) {
  const next = new Set(collapsed.value);
  if (next.has(userId))
    next.delete(userId);
  else next.add(userId);
  collapsed.value = next;
}
function columnCount(col: { events: DashEvent[]; chores: ChoreBoardItem[]; schoolItems: SchoolItem[]; school: string }) {
  return col.events.length + col.chores.length + col.schoolItems.length + (col.school ? 1 : 0);
}

const celebration = ref<{ name: string; pointsToday: number; streak: number; newBadges: NewBadge[] } | null>(null);

function canToggle(assigneeId: string | undefined) {
  return isAdmin.value || user.value?.id === assigneeId;
}
function canToggleChore(chore: ChoreBoardItem) {
  if (isAdmin.value)
    return true;
  // Up-for-grabs: only the claimer can undo their own claim.
  if (chore.claimable && chore.done)
    return user.value?.id === chore.claimedById;
  return user.value?.id === chore.assignee?.id;
}
async function toggleChore(chore: ChoreBoardItem) {
  if (!canToggleChore(chore) || !chore.assignee)
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

const mealBySlot = computed(() => {
  const map: Record<string, Meal> = {};
  for (const m of meals.value ?? []) map[m.slot] = m;
  return map;
});
const slots: { key: MealSlot; label: string; icon: string }[] = [
  { key: "BREAKFAST", label: "Breakfast", icon: "i-lucide-coffee" },
  { key: "LUNCH", label: "Lunch", icon: "i-lucide-sandwich" },
  { key: "DINNER", label: "Dinner", icon: "i-lucide-utensils" },
];

function eventTime(e: DashEvent) {
  if (e.allDay)
    return "All day";
  return new Date(e.start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
function eventDotColor(e: DashEvent): string {
  const c = Array.isArray(e.color) ? e.color[0] : e.color;
  return c || "#6b7280";
}
const longDate = new Date(`${today}T00:00:00`).toLocaleDateString(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
});
</script>

<template>
  <div class="flex w-full flex-col">
    <div class="sticky top-0 z-40 flex items-center gap-3 border-b border-default bg-default bg-gradient-to-r from-primary/10 to-transparent px-4 py-5">
      <div class="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary shadow-sm">
        <UIcon name="i-lucide-sun" class="size-6" />
      </div>
      <div class="min-w-0">
        <h1 class="text-2xl font-bold">
          Today
        </h1>
        <p class="text-muted">
          {{ longDate }}
        </p>
      </div>
      <USelect
        v-model="selectedTheme"
        :items="THEME_OPTIONS"
        value-attribute="value"
        option-attribute="label"
        size="sm"
        class="ml-auto w-40 shrink-0"
        :ui="{ content: 'min-w-fit' }"
        aria-label="Quick theme switch"
      />
    </div>

    <ClientOnly>
      <FamilyBulletin />
      <NuxtLink
        v-if="unreadNotes > 0"
        to="/messages"
        class="mx-4 mt-4 flex items-center gap-2 rounded-lg border border-default bg-elevated/50 px-3 py-2 transition hover:bg-elevated"
      >
        <span class="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold text-white">
          {{ unreadNotes > 9 ? "9+" : unreadNotes }}
        </span>
        <span class="text-sm font-medium">
          You have {{ unreadNotes }} new unread {{ unreadNotes === 1 ? "note" : "notes" }}
        </span>
        <UIcon name="i-lucide-arrow-right" class="ml-auto size-4 text-muted" />
      </NuxtLink>

      <!-- Family strip: meals + whole-family events -->
      <div class="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-default bg-gradient-to-r from-warning/8 to-transparent px-4 py-3 text-sm">
        <span
          v-for="s in slots"
          :key="s.key"
          class="flex items-center gap-1.5"
        >
          <UIcon :name="s.icon" class="size-4 shrink-0 text-warning" />
          <span class="text-muted">{{ s.label }}:</span>
          <span class="font-medium">{{ mealBySlot[s.key]?.title || "—" }}</span>
        </span>
        <span
          v-for="e in familyEvents"
          :key="e.id"
          class="flex items-center gap-1.5"
        >
          <span class="size-2 rounded-full" :style="{ backgroundColor: eventDotColor(e) }" />
          <span class="font-medium">{{ e.title }}</span>
          <span class="text-xs text-muted">{{ eventTime(e) }}</span>
        </span>
        <NuxtLink to="/mealPlanner" class="ml-auto text-xs text-muted underline-offset-2 hover:underline">
          Meal planner →
        </NuxtLink>
      </div>

      <!-- One column per person, kanban-style; wraps/stacks when space is tight -->
      <div class="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4 p-4">
        <section
          v-for="col in columns"
          :key="col.user.id"
          class="flex h-fit flex-col rounded-lg border-2 border-default bg-default shadow-sm"
          :style="col.user.color ? { borderColor: col.user.color } : {}"
        >
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-t-lg border-b border-default p-3 text-left"
            :style="col.user.color ? { background: `linear-gradient(135deg, ${col.user.color}2e, ${col.user.color}0a)` } : {}"
            @click="toggleCollapsed(col.user.id)"
          >
            <UAvatar
              :src="col.user.avatar || undefined"
              :alt="col.user.name"
              size="sm"
            />
            <span class="min-w-0 truncate font-semibold">{{ col.user.name }}</span>
            <span v-if="(col.stats?.streak ?? 0) > 0" class="shrink-0 text-xs text-muted">🔥 {{ col.stats!.streak }}</span>
            <UBadge
              color="primary"
              variant="subtle"
              size="sm"
              class="ml-auto shrink-0"
            >
              {{ col.stats?.pointsTotal ?? 0 }} pts
            </UBadge>
            <span v-if="collapsed.has(col.user.id)" class="shrink-0 text-xs text-muted">({{ columnCount(col) }})</span>
            <UIcon
              :name="collapsed.has(col.user.id) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'"
              class="size-4 shrink-0 text-muted"
            />
          </button>

          <div v-if="!collapsed.has(col.user.id)" class="flex flex-col gap-1 p-3">
            <!-- Their calendar for today -->
            <div
              v-for="e in col.events"
              :key="e.id"
              class="flex items-center gap-2 text-sm"
            >
              <span class="ml-0.5 size-2 shrink-0 rounded-full" :style="{ backgroundColor: eventDotColor(e) }" />
              <span class="truncate">{{ e.title }}</span>
              <span class="ml-auto shrink-0 text-xs text-muted">{{ eventTime(e) }}</span>
            </div>

            <!-- Chores due today, grouped by area -->
            <template
              v-for="grp in col.choreGroups"
              :key="grp.area?.id ?? '__none__'"
            >
              <div
                v-if="col.choreGroups.length > 1 || grp.area"
                class="mt-1 flex items-center gap-1 text-xs font-semibold text-muted"
              >
                <span v-if="grp.area?.icon && !grp.area.icon.startsWith('i-')">{{ grp.area.icon }}</span>
                <UIcon
                  v-else-if="grp.area"
                  :name="grp.area.icon || 'i-lucide-folder'"
                  class="size-3"
                />
                <span>{{ grp.area?.name ?? "Other" }}</span>
              </div>
              <div
                v-for="chore in grp.chores"
                :key="`${chore.id}:${col.user.id}`"
                class="flex items-center gap-2 text-sm"
                :class="chore.done ? 'text-muted' : ''"
              >
                <UCheckbox
                  :model-value="chore.done"
                  :disabled="!canToggleChore(chore)"
                  @update:model-value="toggleChore(chore)"
                />
                <span class="truncate" :class="chore.done ? 'line-through' : ''">{{ chore.title }}</span>
                <UIcon
                  v-if="chore.reward"
                  name="i-lucide-gift"
                  class="size-3.5 shrink-0 text-primary"
                  :title="`Reward: ${chore.reward.name}`"
                />
                <UIcon
                  v-if="chore.claimable && !chore.done"
                  name="i-lucide-hand"
                  class="size-3.5 shrink-0 text-primary"
                  title="Up for grabs"
                />
                <span class="shrink-0 text-xs text-muted">{{ recurrenceLabel(chore) }}</span>
                <UBadge
                  v-if="chore.boost"
                  color="primary"
                  variant="soft"
                  size="sm"
                  icon="i-lucide-trending-up"
                  class="ml-auto shrink-0"
                  :title="`Neglected chore — boosted +${chore.boost}`"
                >
                  +{{ chore.boost }}
                </UBadge>
                <span class="shrink-0 text-xs text-muted" :class="{ 'ml-auto': !chore.boost }">+{{ chore.points }}</span>
                <UButton
                  v-if="!chore.done && canToggleChore(chore)"
                  icon="i-lucide-timer"
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  aria-label="Start a timer for this chore"
                  @click="startTimerFor({ kind: 'chore', id: chore.id, userId: col.user.id, title: chore.title, assigneeName: col.user.name })"
                />
              </div>
            </template>

            <!-- School items -->
            <div
              v-for="item in col.schoolItems"
              :key="item.id"
              class="flex items-center gap-2 text-sm"
              :class="item.done ? 'text-muted' : ''"
            >
              <UCheckbox
                :model-value="item.done"
                :disabled="!canToggle(item.userId)"
                @update:model-value="toggleSchoolItem(item)"
              />
              <UIcon name="i-lucide-graduation-cap" class="size-3.5 shrink-0 text-success" />
              <span class="truncate" :class="item.done ? 'line-through' : ''">{{ item.title }}</span>
              <span
                class="ml-auto shrink-0 text-xs"
                :class="!item.done && item.dueDate < today ? 'font-medium text-error' : 'text-muted'"
              >
                {{ schoolDueLabel(item) }}<template v-if="item.points > 0"> · +{{ item.points }}</template>
              </span>
              <UButton
                v-if="!item.done && canToggle(item.userId)"
                icon="i-lucide-timer"
                size="xs"
                variant="ghost"
                color="neutral"
                aria-label="Start a timer for this assignment"
                @click="startTimerFor({ kind: 'school', id: item.id, title: item.title })"
              />
            </div>

            <!-- Free-text school note -->
            <p v-if="col.school" class="mt-1 flex items-start gap-1.5 text-sm">
              <UIcon name="i-lucide-graduation-cap" class="mt-0.5 size-4 shrink-0 text-success" />
              <span class="whitespace-pre-wrap">{{ col.school }}</span>
            </p>

            <p v-if="columnCount(col) === 0" class="py-2 text-center text-sm text-muted">
              Nothing today 🎉
            </p>
          </div>
        </section>
      </div>

      <div class="flex items-center gap-2 px-4 pb-4">
        <UButton
          to="/chores"
          label="Chore board"
          variant="ghost"
          color="neutral"
          size="sm"
          trailing-icon="i-lucide-arrow-right"
        />
        <UButton
          to="/school"
          label="School"
          variant="ghost"
          color="neutral"
          size="sm"
          trailing-icon="i-lucide-arrow-right"
        />
        <UButton
          to="/calendar"
          label="Calendar"
          variant="ghost"
          color="neutral"
          size="sm"
          trailing-icon="i-lucide-arrow-right"
        />
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
