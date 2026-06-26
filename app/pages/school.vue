<script setup lang="ts">
import type { CreateSchoolItemInput, SchoolItem } from "~/composables/useSchoolItems";

import SchoolItemDialog from "~/components/school/schoolItemDialog.vue";

const { user } = useUserSession();
const isAdmin = computed(() => user.value?.role === "ADMIN");
const { gate } = useAdminGate();

const weekStart = ref(weekStartMonday(isoToday()));
const { noteByCell, saveNote } = useSchool(weekStart);
const { itemsByUser, createItem, updateItem, removeItem, setDone } = useSchoolItems(weekStart);
const toast = useToast();

const requestFetch = useRequestFetch();
const { data: users } = await useAsyncData(
  "school-users",
  () => requestFetch<{ id: string; name: string; avatar: string | null; color: string | null; role: string }[]>("/api/users"),
  { default: () => [], server: false },
);

// "Students only" hides the parents' (admin) rows — per-device preference.
const { preferences, updatePreferences } = useClientPreferences();
const studentsOnly = computed({
  get: () => preferences.value?.schoolStudentsOnly !== false,
  set: value => updatePreferences({ schoolStudentsOnly: value }),
});
const visibleUsers = computed(() =>
  (users.value ?? []).filter(u => !studentsOnly.value || u.role === "MEMBER"),
);

const days = computed(() => Array.from({ length: 5 }, (_, i) => addDaysIso(weekStart.value, i)));
const today = isoToday();

// Members with items this week (or overdue), for the Assignments section.
const assignmentGroups = computed(() =>
  visibleUsers.value
    .map(u => ({ user: u, items: itemsByUser.value[u.id] ?? [] }))
    .filter(g => g.items.length > 0),
);

function prevWeek() {
  weekStart.value = addDaysIso(weekStart.value, -7);
}
function nextWeek() {
  weekStart.value = addDaysIso(weekStart.value, 7);
}
function thisWeek() {
  weekStart.value = weekStartMonday(isoToday());
}

function canEdit(userId: string) {
  return isAdmin.value || user.value?.id === userId;
}
function cellText(userId: string, date: string) {
  return noteByCell.value[`${userId}|${date}`] ?? "";
}
async function onCellBlur(userId: string, date: string, e: FocusEvent) {
  const text = (e.target as HTMLTextAreaElement).value;
  if (text === cellText(userId, date))
    return; // unchanged
  await saveNote(userId, date, text);
}

// --- Assignments (structured, check-off, gamified like chores) ---
const dialogOpen = ref(false);
const editing = ref<SchoolItem | null>(null);

function isOverdue(item: SchoolItem) {
  return !item.done && item.dueDate < today;
}
async function toggleItem(item: SchoolItem) {
  if (!canEdit(item.userId))
    return;
  const result = await setDone(item.id, !item.done);
  for (const b of result?.newBadges ?? []) {
    toast.add({ title: `New badge: ${b.label}!`, icon: b.icon, color: "primary" });
  }
}
function addItem() {
  gate(() => {
    editing.value = null;
    dialogOpen.value = true;
  });
}
function editItem(item: SchoolItem) {
  gate(() => {
    editing.value = item;
    dialogOpen.value = true;
  });
}
async function onItemSave(data: CreateSchoolItemInput) {
  await gate(async () => {
    if (editing.value) {
      const { userIds, ...fields } = data;
      await updateItem(editing.value.id, { ...fields, userId: userIds[0] });
    }
    else {
      await createItem(data);
    }
  });
}
async function onItemDelete(id: string) {
  await gate(() => removeItem(id));
}
</script>

<template>
  <div class="flex w-full flex-col">
    <div class="sticky top-0 z-40 flex flex-wrap items-center gap-3 border-b border-default bg-default py-4 sm:px-4">
      <h1 class="text-xl font-bold">
        School
      </h1>
      <div class="flex items-center gap-2">
        <UButton
          icon="i-lucide-chevron-left"
          variant="ghost"
          color="neutral"
          aria-label="Previous week"
          @click="prevWeek"
        />
        <UButton
          label="This week"
          variant="soft"
          color="neutral"
          size="sm"
          @click="thisWeek"
        />
        <UButton
          icon="i-lucide-chevron-right"
          variant="ghost"
          color="neutral"
          aria-label="Next week"
          @click="nextWeek"
        />
        <span class="ml-2 text-sm text-muted">Week of {{ dayLabel(weekStart) }}</span>
      </div>
      <div class="ml-auto flex items-center gap-3">
        <div class="flex items-center gap-2 text-sm text-muted">
          <USwitch
            v-model="studentsOnly"
            size="sm"
            aria-label="Show students only"
          />
          <span>Students only</span>
        </div>
        <UButton
          v-if="isAdmin"
          icon="i-lucide-plus"
          label="Add assignment"
          @click="addItem"
        />
      </div>
    </div>

    <ClientOnly>
      <!-- Assignments: dated items checked off like chores, same points pool -->
      <div v-if="assignmentGroups.length" class="border-b border-default p-4">
        <h2 class="mb-3 text-lg font-semibold">
          Assignments
        </h2>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="group in assignmentGroups" :key="group.user.id">
            <div class="mb-1 flex items-center gap-2">
              <UAvatar
                :src="group.user.avatar || undefined"
                :alt="group.user.name"
                size="2xs"
              />
              <span class="font-medium">{{ group.user.name }}</span>
            </div>
            <ul class="flex flex-col gap-1">
              <li
                v-for="item in group.items"
                :key="item.id"
                class="flex items-center gap-3 rounded-lg p-2 hover:bg-elevated"
                :class="item.done ? 'opacity-60' : ''"
              >
                <UCheckbox
                  :model-value="item.done"
                  :disabled="!canEdit(item.userId)"
                  size="xl"
                  @update:model-value="toggleItem(item)"
                />
                <div class="min-w-0 flex-1">
                  <p class="truncate font-medium" :class="item.done ? 'line-through' : ''">
                    {{ item.title }}
                  </p>
                  <p class="text-xs" :class="isOverdue(item) ? 'font-medium text-error' : 'text-muted'">
                    {{ isOverdue(item) ? "Overdue — " : "" }}due {{ dayLabel(item.dueDate) }}
                    <template v-if="item.description">
                      · {{ item.description }}
                    </template>
                  </p>
                </div>
                <UBadge
                  v-if="item.grade"
                  color="primary"
                  variant="soft"
                >
                  {{ item.grade }}
                </UBadge>
                <UBadge
                  v-if="item.points > 0"
                  color="neutral"
                  variant="soft"
                >
                  +{{ item.points }}
                </UBadge>
                <UButton
                  v-if="isAdmin"
                  icon="i-lucide-pencil"
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  aria-label="Edit assignment"
                  @click="editItem(item)"
                />
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Weekly free-text notes grid -->
      <div class="overflow-x-auto p-4">
        <div class="grid min-w-[760px] grid-cols-[8rem_repeat(5,minmax(0,1fr))] gap-2">
          <!-- header -->
          <div />
          <div
            v-for="d in days"
            :key="`h-${d}`"
            class="px-2 pb-1 text-center text-sm font-semibold"
            :class="d === today ? 'text-primary' : ''"
          >
            {{ dayLabel(d) }}
          </div>

          <!-- one row per member -->
          <template v-for="u in visibleUsers" :key="u.id">
            <div class="flex items-center gap-2 text-sm font-medium">
              <UAvatar
                :src="u.avatar || undefined"
                :alt="u.name"
                size="2xs"
              />
              <span class="truncate">{{ u.name }}</span>
            </div>
            <div
              v-for="d in days"
              :key="`${u.id}-${d}`"
              class="rounded-lg border border-default p-1"
              :class="d === today ? 'bg-elevated/50' : ''"
            >
              <textarea
                v-if="canEdit(u.id)"
                :value="cellText(u.id, d)"
                rows="2"
                placeholder="—"
                class="h-full min-h-14 w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted"
                @blur="onCellBlur(u.id, d, $event)"
              />
              <p
                v-else
                class="min-h-14 whitespace-pre-wrap p-1 text-sm"
                :class="cellText(u.id, d) ? '' : 'text-muted'"
              >
                {{ cellText(u.id, d) || "—" }}
              </p>
            </div>
          </template>
        </div>
      </div>
      <template #fallback>
        <div class="p-4 text-muted">
          Loading school week…
        </div>
      </template>
    </ClientOnly>

    <SchoolItemDialog
      :is-open="dialogOpen"
      :item="editing"
      :users="users ?? []"
      @close="dialogOpen = false"
      @save="onItemSave"
      @delete="onItemDelete"
    />
  </div>
</template>
