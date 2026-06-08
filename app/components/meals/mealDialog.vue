<script setup lang="ts">
import type { Meal, MealSlot, UpsertMealInput } from "~/composables/useMeals";

const props = defineProps<{
  isOpen: boolean;
  date: string;
  mealSlot: MealSlot;
  meal?: Meal | null;
  users: { id: string; name: string }[];
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", data: UpsertMealInput): void;
  (e: "delete", id: string): void;
}>();

const title = ref("");
const notes = ref("");
const ingredients = ref("");
const time = ref("");
const cookId = ref("");
const errorMsg = ref<string | null>(null);

const NO_COOK = "none"; // Nuxt UI USelect disallows empty-string values
const slotLabel = computed(() => ({ BREAKFAST: "Breakfast", LUNCH: "Lunch", DINNER: "Dinner" }[props.mealSlot]));
const cookOptions = computed(() => [
  { label: "— No cook —", value: NO_COOK },
  ...props.users.map(u => ({ label: u.name, value: u.id })),
]);

const watchSource = computed(() => ({ isOpen: props.isOpen, meal: props.meal }));
watch(
  watchSource,
  ({ isOpen, meal }) => {
    if (!isOpen) return;
    title.value = meal?.title ?? "";
    notes.value = meal?.notes ?? "";
    ingredients.value = meal?.ingredients ?? "";
    time.value = meal?.time ?? "";
    cookId.value = meal?.cookId ?? NO_COOK;
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
    date: props.date,
    slot: props.mealSlot,
    title: title.value.trim(),
    notes: notes.value.trim(),
    ingredients: ingredients.value.trim(),
    time: time.value.trim(),
    cookId: cookId.value && cookId.value !== NO_COOK ? cookId.value : null,
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
          {{ slotLabel }} — {{ dayLabel(date) }}
        </h3>
        <UButton color="neutral" variant="ghost" icon="i-lucide-x" aria-label="Close dialog" @click="emit('close')" />
      </div>

      <div class="space-y-4 p-4">
        <div v-if="errorMsg" class="rounded-md bg-error/10 px-3 py-2 text-sm text-error">
          {{ errorMsg }}
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">Meal</label>
          <UInput v-model="title" placeholder="e.g. Spaghetti night" class="w-full" :ui="{ base: 'w-full' }" @keyup.enter="handleSave" />
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">Notes (optional)</label>
          <UInput v-model="notes" placeholder="Recipe link, reminders…" class="w-full" :ui="{ base: 'w-full' }" />
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">Ingredients (one per line)</label>
          <UTextarea
            v-model="ingredients"
            :rows="4"
            placeholder="1 lb pasta&#10;2 jars marinara&#10;parmesan"
            class="w-full"
            :ui="{ base: 'w-full' }"
          />
          <p class="text-xs text-muted">
            Used by “Generate this week's groceries”.
          </p>
        </div>

        <div class="flex gap-4">
          <div class="flex-1 space-y-2">
            <label class="block text-sm font-medium text-highlighted">Cook (optional)</label>
            <USelect
              v-model="cookId"
              :items="cookOptions"
              option-attribute="label"
              value-attribute="value"
              class="w-full"
              :ui="{ base: 'w-full' }"
            />
          </div>
          <div class="w-32 space-y-2">
            <label class="block text-sm font-medium text-highlighted">Time (optional)</label>
            <UInput v-model="time" type="time" class="w-full" :ui="{ base: 'w-full' }" />
          </div>
        </div>
      </div>

      <div class="flex justify-between border-t border-default p-4">
        <UButton
          v-if="meal?.id"
          color="error"
          variant="ghost"
          icon="i-lucide-trash"
          @click="emit('delete', meal.id); emit('close')"
        >
          Clear
        </UButton>
        <div class="flex gap-2" :class="{ 'ml-auto': !meal?.id }">
          <UButton color="neutral" variant="ghost" @click="emit('close')">
            Cancel
          </UButton>
          <UButton color="primary" @click="handleSave">
            Save
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
