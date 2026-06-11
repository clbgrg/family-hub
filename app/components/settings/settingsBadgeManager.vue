<script setup lang="ts">
import type { BadgeDef, CreateBadgeInput } from "~/composables/useBadges";

import BadgeDialog from "~/components/rewards/badgeDialog.vue";
import { badgeConditionSummary } from "~/composables/useBadges";

// Rendered inside the settings parent-unlock section, so the UI is already
// behind the gate; gate() here covers the window expiring mid-edit.
const { gate } = useAdminGate();
const { badges, createBadge, updateBadge, deleteBadge } = useBadges();

const requestFetch = useRequestFetch();
const { data: users } = await useAsyncData(
  "badge-manager-users",
  () => requestFetch<{ id: string; name: string }[]>("/api/users"),
  { default: () => [], server: false },
);

const nameById = computed(() => {
  const map: Record<string, string> = {};
  for (const u of users.value ?? []) map[u.id] = u.name;
  return map;
});

const dialogOpen = ref(false);
const editing = ref<BadgeDef | null>(null);

function appliesToLabel(b: BadgeDef): string {
  if (!b.appliesToUserIds.length)
    return "Everyone";
  return b.appliesToUserIds.map(id => nameById.value[id] ?? "former member").join(", ");
}

function addBadge() {
  editing.value = null;
  dialogOpen.value = true;
}
function editBadge(b: BadgeDef) {
  editing.value = b;
  dialogOpen.value = true;
}
async function onSave(data: CreateBadgeInput) {
  await gate(async () => {
    if (editing.value)
      await updateBadge(editing.value.id, data);
    else await createBadge(data);
  });
}
async function onDelete(id: string) {
  await gate(() => deleteBadge(id));
}
</script>

<template>
  <div>
    <div class="mb-3 flex items-center justify-between">
      <p class="text-sm text-muted">
        Badges are earned automatically when a member meets every condition.
      </p>
      <UButton
        icon="i-lucide-plus"
        label="Add badge"
        size="sm"
        @click="addBadge"
      />
    </div>
    <ul class="flex flex-col gap-2">
      <li
        v-for="b in badges"
        :key="b.id"
        class="flex items-center gap-3 rounded-lg border border-default p-3"
      >
        <UTooltip :text="b.description || b.name">
          <UIcon :name="b.icon || 'i-lucide-award'" class="size-6 text-primary" />
        </UTooltip>
        <div class="min-w-0 flex-1">
          <p class="truncate font-medium">
            {{ b.name }}
          </p>
          <p class="text-sm text-muted">
            {{ badgeConditionSummary(b.conditions) }}
          </p>
        </div>
        <UBadge color="neutral" variant="soft">
          {{ appliesToLabel(b) }}
        </UBadge>
        <UButton
          icon="i-lucide-pencil"
          size="xs"
          variant="ghost"
          color="neutral"
          aria-label="Edit badge"
          @click="editBadge(b)"
        />
      </li>
    </ul>

    <BadgeDialog
      :is-open="dialogOpen"
      :badge="editing"
      :users="users ?? []"
      @close="dialogOpen = false"
      @save="onSave"
      @delete="onDelete"
    />
  </div>
</template>
