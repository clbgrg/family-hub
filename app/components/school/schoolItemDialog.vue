<script setup lang="ts">
import type { CreateSchoolItemInput, SchoolItem } from "~/composables/useSchoolItems";

const props = defineProps<{
  isOpen: boolean;
  item?: SchoolItem | null;
  users: { id: string; name: string }[];
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", data: CreateSchoolItemInput): void;
  (e: "delete", id: string): void;
}>();

const title = ref("");
const description = ref("");
const points = ref(0);
const dueDate = ref("");
const userIds = ref<string[]>([]);
const error = ref<string | null>(null);

const watchSource = computed(() => ({ isOpen: props.isOpen, item: props.item }));
watch(
  watchSource,
  ({ isOpen, item }) => {
    if (!isOpen)
      return;
    title.value = item?.title ?? "";
    description.value = item?.description ?? "";
    points.value = item?.points ?? 0;
    dueDate.value = item?.dueDate ?? isoToday();
    userIds.value = item ? [item.userId] : (props.users[0] ? [props.users[0].id] : []);
    error.value = null;
  },
  { immediate: true },
);

function toggleUser(id: string) {
  // Editing an existing item keeps single-assignee semantics (one row per
  // kid); multi-select only fans out on CREATE.
  if (props.item) {
    userIds.value = [id];
    return;
  }
  userIds.value = userIds.value.includes(id)
    ? userIds.value.filter(x => x !== id)
    : [...userIds.value, id];
}

function handleSave() {
  if (!title.value.trim()) {
    error.value = "What's the assignment?";
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate.value)) {
    error.value = "Pick a due date";
    return;
  }
  if (userIds.value.length === 0) {
    error.value = "Choose who it's for";
    return;
  }
  emit("save", {
    title: title.value.trim(),
    description: description.value.trim(),
    points: Math.max(0, Number(points.value) || 0),
    dueDate: dueDate.value,
    userIds: userIds.value,
  });
  emit("close");
}
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
    @click="emit('close')"
  >
    <div
      class="w-[460px] max-h-[90vh] overflow-y-auto rounded-lg border border-default bg-default shadow-lg"
      @click.stop
    >
      <div class="flex items-center justify-between border-b border-default p-4">
        <h3 class="text-base font-semibold leading-6">
          {{ item?.id ? "Edit Assignment" : "Add Assignment" }}
        </h3>
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-x"
          aria-label="Close dialog"
          @click="emit('close')"
        />
      </div>

      <div class="space-y-4 p-4">
        <div v-if="error" class="rounded-md bg-error/10 px-3 py-2 text-sm text-error">
          {{ error }}
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">Assignment</label>
          <UInput
            v-model="title"
            placeholder="e.g. Spelling packet"
            class="w-full"
            :ui="{ base: 'w-full' }"
            @keyup.enter="handleSave"
          />
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">Notes (optional)</label>
          <UInput
            v-model="description"
            placeholder="Any details"
            class="w-full"
            :ui="{ base: 'w-full' }"
          />
        </div>

        <div class="flex gap-4">
          <div class="flex-1 space-y-2">
            <label class="block text-sm font-medium text-highlighted">Due date</label>
            <UInput
              v-model="dueDate"
              type="date"
              class="w-full"
              :ui="{ base: 'w-full' }"
            />
          </div>
          <div class="w-28 space-y-2">
            <label class="block text-sm font-medium text-highlighted">Points</label>
            <UInput
              v-model.number="points"
              type="number"
              :min="0"
              class="w-full"
              :ui="{ base: 'w-full' }"
            />
          </div>
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">For</label>
          <p v-if="!item" class="text-xs text-muted">
            Pick one or more — each person gets their own copy to check off.
          </p>
          <div class="flex flex-wrap gap-1">
            <UButton
              v-for="u in users"
              :key="u.id"
              :label="u.name"
              size="sm"
              :variant="userIds.includes(u.id) ? 'solid' : 'outline'"
              :color="userIds.includes(u.id) ? 'primary' : 'neutral'"
              @click="toggleUser(u.id)"
            />
          </div>
        </div>
      </div>

      <div class="flex justify-between border-t border-default p-4">
        <UButton
          v-if="item?.id"
          color="error"
          variant="ghost"
          icon="i-lucide-trash"
          @click="emit('delete', item.id); emit('close')"
        >
          Delete
        </UButton>
        <div class="flex gap-2" :class="{ 'ml-auto': !item?.id }">
          <UButton
            color="neutral"
            variant="ghost"
            @click="emit('close')"
          >
            Cancel
          </UButton>
          <UButton color="primary" @click="handleSave">
            {{ item?.id ? "Save" : "Add" }}
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
