<script setup lang="ts">
import type { ChoreBoardItem, CreateChoreInput, NewBadge } from "~/composables/useChores";

const { user } = useUserSession();
const isAdmin = computed(() => user.value?.role === "ADMIN");
// Opening the add/edit dialog needs a fresh parent PIN (shared kiosk session);
// the server enforces the same on the mutation endpoints.
const { gate } = useAdminGate();

const { chores, pointsByUser, statsByUser, leaderboard, createChore, updateChore, deleteChore, setDone } = useChores();

// useRequestFetch forwards the cookie on SSR (plain $fetch would 401).
const requestFetch = useRequestFetch();
const { data: users } = await useAsyncData(
  "chores-users",
  () => requestFetch<{ id: string; name: string; avatar: string | null; color: string | null }[]>("/api/users"),
  { default: () => [], server: false },
);

// Group today's due chores under each family member, with their stats.
const board = computed(() => {
  const due = (chores.value ?? []).filter(c => c.dueToday);
  return (users.value ?? []).map((u) => {
    const s = statsByUser.value[u.id];
    return {
      user: u,
      points: pointsByUser.value[u.id] ?? 0,
      streak: s?.streak ?? 0,
      badges: s?.badges ?? [],
      chores: due.filter(c => c.assignee?.id === u.id),
    };
  });
});

// Weekly-points ranking with member info.
const ranking = computed(() => {
  const byId = new Map((users.value ?? []).map(u => [u.id, u]));
  return leaderboard.value
    .map(s => ({ ...s, user: byId.get(s.userId) }))
    .filter(r => r.user && r.pointsWeek > 0);
});

const dialogOpen = ref(false);
const editing = ref<ChoreBoardItem | null>(null);
const celebration = ref<{ name: string; pointsToday: number; streak: number; newBadges: NewBadge[] } | null>(null);

function canToggle(chore: ChoreBoardItem) {
  return isAdmin.value || user.value?.id === chore.assignee?.id;
}
async function toggle(chore: ChoreBoardItem) {
  if (!canToggle(chore) || !chore.assignee)
    return;
  const result = await setDone(chore.id, !chore.done, chore.assignee.id);
  if (result?.allDoneToday) {
    celebration.value = {
      name: chore.assignee?.name ?? "you",
      pointsToday: result.pointsToday,
      streak: result.streak,
      newBadges: result.newBadges,
    };
  }
}
function addChore() {
  gate(() => {
    editing.value = null;
    dialogOpen.value = true;
  });
}
function editChore(chore: ChoreBoardItem) {
  gate(() => {
    editing.value = chore;
    dialogOpen.value = true;
  });
}
// gate() also wraps the mutations so an expired unlock (dialog left open
// past the window) re-prompts and retries instead of failing silently.
async function onSave(data: CreateChoreInput) {
  await gate(async () => {
    if (editing.value)
      await updateChore(editing.value.id, data);
    else await createChore(data);
  });
}
async function onDelete(id: string) {
  await gate(() => deleteChore(id));
}
</script>

<template>
  <div class="flex w-full flex-col">
    <div class="sticky top-0 z-40 flex items-center justify-between gap-4 border-b border-default bg-default py-5 sm:px-4">
      <GlobalDateHeader />
      <UButton
        v-if="isAdmin"
        icon="i-lucide-plus"
        label="Add chore"
        @click="addChore"
      />
    </div>

    <ClientOnly>
      <!-- Weekly leaderboard -->
      <div
        v-if="ranking.length"
        class="flex items-center gap-4 overflow-x-auto border-b border-default px-4 py-2 text-sm"
      >
        <span class="font-semibold whitespace-nowrap">🏆 This week</span>
        <span
          v-for="(r, i) in ranking"
          :key="r.userId"
          class="flex items-center gap-1 whitespace-nowrap"
        >
          <span class="text-muted">{{ i + 1 }}.</span>
          {{ r.user!.name }}
          <span class="font-medium">{{ r.pointsWeek }} pts</span>
        </span>
      </div>

      <div class="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
        <UCard v-for="group in board" :key="group.user.id">
          <template #header>
            <div class="flex items-center gap-3">
              <UAvatar
                :src="group.user.avatar || undefined"
                :alt="group.user.name"
                size="lg"
              />
              <div class="min-w-0 flex-1">
                <p class="truncate text-lg font-semibold">
                  {{ group.user.name }}
                </p>
                <div class="flex items-center gap-2 text-sm text-muted">
                  <span v-if="group.streak > 0" :title="`${group.streak}-day streak`">🔥 {{ group.streak }}</span>
                  <UIcon
                    v-for="b in group.badges"
                    :key="b.key"
                    :name="b.icon"
                    class="size-4 text-primary"
                    :title="b.label"
                  />
                </div>
              </div>
              <UBadge
                color="primary"
                variant="subtle"
                size="lg"
              >
                {{ group.points }} pts
              </UBadge>
            </div>
          </template>

          <ul class="flex flex-col gap-1">
            <li
              v-for="chore in group.chores"
              :key="`${chore.id}:${group.user.id}`"
              class="flex items-center gap-3 rounded-lg p-2 hover:bg-elevated"
              :class="chore.done ? 'opacity-60' : ''"
            >
              <UCheckbox
                :model-value="chore.done"
                :disabled="!canToggle(chore)"
                size="xl"
                @update:model-value="toggle(chore)"
              />
              <div class="min-w-0 flex-1">
                <p class="truncate font-medium" :class="chore.done ? 'line-through' : ''">
                  {{ chore.title }}
                </p>
                <p v-if="chore.description" class="truncate text-sm text-muted">
                  {{ chore.description }}
                </p>
              </div>
              <UBadge color="neutral" variant="soft">
                +{{ chore.points }}
              </UBadge>
              <UButton
                v-if="isAdmin"
                icon="i-lucide-pencil"
                size="xs"
                variant="ghost"
                color="neutral"
                aria-label="Edit chore"
                @click="editChore(chore)"
              />
            </li>
            <li v-if="group.chores.length === 0" class="p-2 text-sm text-muted">
              No chores today 🎉
            </li>
          </ul>
        </UCard>
      </div>
      <template #fallback>
        <div class="p-4 text-muted">
          Loading chores…
        </div>
      </template>
    </ClientOnly>

    <ChoreDialog
      :is-open="dialogOpen"
      :chore="editing"
      :users="users ?? []"
      @close="dialogOpen = false"
      @save="onSave"
      @delete="onDelete"
    />

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
