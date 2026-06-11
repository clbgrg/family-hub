<script setup lang="ts">
import type { BadgeDef, CreateBadgeInput } from "~/composables/useBadges";

import BadgeDialog from "~/components/rewards/badgeDialog.vue";
import { BADGE_RULE_LABELS } from "~/composables/useBadges";

// Rendered inside the settings parent-unlock section, so the UI is already
// behind the gate; gate() here covers the window expiring mid-edit.
const { gate } = useAdminGate();
const { badges, createBadge, updateBadge, deleteBadge } = useBadges();

const dialogOpen = ref(false);
const editing = ref<BadgeDef | null>(null);

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
        Badges are earned automatically when a member hits the rule below.
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
        <UIcon :name="b.icon || 'i-lucide-award'" class="size-6 text-primary" />
        <div class="min-w-0 flex-1">
          <p class="truncate font-medium">
            {{ b.name }}
          </p>
          <p class="text-sm text-muted">
            {{ BADGE_RULE_LABELS[b.ruleType] }} {{ b.threshold }}
          </p>
        </div>
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
      @close="dialogOpen = false"
      @save="onSave"
      @delete="onDelete"
    />
  </div>
</template>
