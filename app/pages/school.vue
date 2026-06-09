<script setup lang="ts">
const { user } = useUserSession();
const isAdmin = computed(() => user.value?.role === "ADMIN");

const weekStart = ref(weekStartMonday(isoToday()));
const { noteByCell, saveNote } = useSchool(weekStart);

const requestFetch = useRequestFetch();
const { data: users } = await useAsyncData(
  "school-users",
  () => requestFetch<{ id: string; name: string; avatar: string | null; color: string | null }[]>("/api/users"),
  { default: () => [], server: false },
);

const days = computed(() => Array.from({ length: 5 }, (_, i) => addDaysIso(weekStart.value, i)));
const today = isoToday();

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
  if (text === cellText(userId, date)) return; // unchanged
  await saveNote(userId, date, text);
}
</script>

<template>
  <div class="flex w-full flex-col">
    <div class="sticky top-0 z-40 flex flex-wrap items-center gap-3 border-b border-default bg-default py-4 sm:px-4">
      <h1 class="text-xl font-bold">
        School
      </h1>
      <div class="flex items-center gap-2">
        <UButton icon="i-lucide-chevron-left" variant="ghost" color="neutral" aria-label="Previous week" @click="prevWeek" />
        <UButton label="This week" variant="soft" color="neutral" size="sm" @click="thisWeek" />
        <UButton icon="i-lucide-chevron-right" variant="ghost" color="neutral" aria-label="Next week" @click="nextWeek" />
        <span class="ml-2 text-sm text-muted">Week of {{ dayLabel(weekStart) }}</span>
      </div>
    </div>

    <ClientOnly>
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
          <template v-for="u in users" :key="u.id">
            <div class="flex items-center gap-2 text-sm font-medium">
              <UAvatar :src="u.avatar || undefined" :alt="u.name" size="2xs" />
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
  </div>
</template>
