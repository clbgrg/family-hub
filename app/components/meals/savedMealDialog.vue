<script setup lang="ts">
import type { CreateSavedMealInput } from "~/composables/useSavedMeals";

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", data: CreateSavedMealInput): void;
}>();

const title = ref("");
const notes = ref("");
const ingredients = ref("");
const errorMsg = ref<string | null>(null);

watch(
  () => props.isOpen,
  (open) => {
    if (!open)
      return;
    title.value = "";
    notes.value = "";
    ingredients.value = "";
    errorMsg.value = null;
  },
  { immediate: true },
);

function handleSave() {
  if (!title.value.trim()) {
    errorMsg.value = "Meal name is required";
    return;
  }
  emit("save", {
    title: title.value.trim(),
    notes: notes.value.trim(),
    ingredients: ingredients.value.trim(),
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
      class="w-[480px] max-h-[90vh] overflow-y-auto rounded-lg border border-default bg-default shadow-lg"
      @click.stop
    >
      <div class="flex items-center justify-between border-b border-default p-4">
        <h3 class="text-base font-semibold leading-6">
          Save a meal
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
        <div v-if="errorMsg" class="rounded-md bg-error/10 px-3 py-2 text-sm text-error">
          {{ errorMsg }}
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">Meal</label>
          <UInput
            v-model="title"
            placeholder="e.g. Chicken Night"
            class="w-full"
            :ui="{ base: 'w-full' }"
            @keyup.enter="handleSave"
          />
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">Notes (optional)</label>
          <UInput
            v-model="notes"
            placeholder="Recipe link, reminders…"
            class="w-full"
            :ui="{ base: 'w-full' }"
          />
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">Ingredients (one per line)</label>
          <UTextarea
            v-model="ingredients"
            :rows="4"
            placeholder="2 lbs chicken&#10;rice&#10;broccoli"
            class="w-full"
            :ui="{ base: 'w-full' }"
          />
          <p class="text-xs text-muted">
            Carried onto the planner when you drop this meal on a day.
          </p>
        </div>
      </div>

      <div class="flex justify-end gap-2 border-t border-default p-4">
        <UButton
          color="neutral"
          variant="ghost"
          @click="emit('close')"
        >
          Cancel
        </UButton>
        <UButton color="primary" @click="handleSave">
          Save meal
        </UButton>
      </div>
    </div>
  </div>
</template>
