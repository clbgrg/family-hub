<script setup lang="ts">
import type { CreateSavedMealInput, SavedMeal } from "~/composables/useSavedMeals";

const props = defineProps<{
  isOpen: boolean;
  // When provided, the dialog edits this meal instead of creating a new one.
  meal?: SavedMeal | null;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", data: CreateSavedMealInput): void;
}>();

const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
] as const;

const title = ref("");
const notes = ref("");
const ingredients = ref("");
const days = ref<number[]>([]);
const errorMsg = ref<string | null>(null);

function toggleDay(d: number) {
  days.value = days.value.includes(d)
    ? days.value.filter(x => x !== d)
    : [...days.value, d];
}

watch(
  () => props.isOpen,
  (open) => {
    if (!open)
      return;
    title.value = props.meal?.title ?? "";
    notes.value = props.meal?.notes ?? "";
    ingredients.value = props.meal?.ingredients ?? "";
    days.value = [...(props.meal?.defaultDays ?? [])];
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
    defaultDays: [...days.value].sort((a, b) => a - b),
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
          {{ meal ? "Edit meal" : "Save a meal" }}
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

        <div class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">Usual days (optional)</label>
          <div class="flex flex-wrap gap-1">
            <UButton
              v-for="d in WEEKDAYS"
              :key="d.value"
              size="xs"
              :variant="days.includes(d.value) ? 'solid' : 'soft'"
              :color="days.includes(d.value) ? 'primary' : 'neutral'"
              @click="toggleDay(d.value)"
            >
              {{ d.label }}
            </UButton>
          </div>
          <p class="text-xs text-muted">
            The days this meal is usually served — quick-add it to a week from the planner.
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
          {{ meal ? "Save changes" : "Save meal" }}
        </UButton>
      </div>
    </div>
  </div>
</template>
