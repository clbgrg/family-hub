<script setup lang="ts">
import type { Area, CreateAreaInput } from "~/composables/useAreas";

// Rendered inside the settings parent-unlock section, so the UI is already
// behind the gate; gate() here covers the window expiring mid-edit.
const { gate } = useAdminGate();
const { areas, createArea, updateArea, deleteArea } = useAreas();

const dialogOpen = ref(false);
const editing = ref<Area | null>(null);

function addArea() {
  editing.value = null;
  dialogOpen.value = true;
}
function editArea(a: Area) {
  editing.value = a;
  dialogOpen.value = true;
}
async function onSave(data: CreateAreaInput) {
  await gate(async () => {
    if (editing.value)
      await updateArea(editing.value.id, data);
    else await createArea(data);
  });
}
async function onDelete(id: string) {
  await gate(() => deleteArea(id));
}
</script>

<template>
  <div>
    <div class="mb-3 flex items-center justify-between">
      <p class="text-sm text-muted">
        Group chores by area (e.g. 🧼 Kitchen, 🛏️ Bedroom) on the board.
      </p>
      <UButton
        icon="i-lucide-plus"
        label="Add area"
        size="sm"
        @click="addArea"
      />
    </div>

    <ul v-if="areas.length" class="flex flex-col gap-2">
      <li
        v-for="a in areas"
        :key="a.id"
        class="flex items-center gap-3 rounded-lg border border-default p-3"
      >
        <span v-if="a.icon && !a.icon.startsWith('i-')" class="text-xl leading-none">{{ a.icon }}</span>
        <UIcon
          v-else
          :name="a.icon || areaIconFor(a.name)"
          class="size-6 text-primary"
        />
        <p class="min-w-0 flex-1 truncate font-medium">
          {{ a.name }}
        </p>
        <UButton
          icon="i-lucide-pencil"
          size="xs"
          variant="ghost"
          color="neutral"
          aria-label="Edit area"
          @click="editArea(a)"
        />
      </li>
    </ul>
    <p
      v-else
      class="rounded-lg border border-dashed border-default p-4 text-center text-sm text-muted"
    >
      No areas yet. Add your first area to group chores on the board.
    </p>

    <SettingsAreaDialog
      :is-open="dialogOpen"
      :area="editing"
      @close="dialogOpen = false"
      @save="onSave"
      @delete="onDelete"
    />
  </div>
</template>
