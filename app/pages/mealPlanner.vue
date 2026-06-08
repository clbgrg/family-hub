<script setup lang="ts">
import type { Meal, MealSlot, UpsertMealInput } from "~/composables/useMeals";

const { user } = useUserSession();
const isAdmin = computed(() => user.value?.role === "ADMIN");

const weekStart = ref(weekStartSunday(isoToday()));
const { mealByCell, upsertMeal, deleteMeal, generateGroceries } = useMeals(weekStart);

const requestFetch = useRequestFetch();
const { data: users } = await useAsyncData(
  "meals-users",
  () => requestFetch<{ id: string; name: string; avatar: string | null; color: string | null }[]>("/api/users"),
  { default: () => [], server: false },
);

const days = computed(() => Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart.value, i)));
const slots: { key: MealSlot; label: string }[] = [
  { key: "BREAKFAST", label: "Breakfast" },
  { key: "LUNCH", label: "Lunch" },
  { key: "DINNER", label: "Dinner" },
];
const today = isoToday();

function prevWeek() {
  weekStart.value = addDaysIso(weekStart.value, -7);
}
function nextWeek() {
  weekStart.value = addDaysIso(weekStart.value, 7);
}
function thisWeek() {
  weekStart.value = weekStartSunday(isoToday());
}

const dialogOpen = ref(false);
const editing = ref<{ date: string; slot: MealSlot; meal: Meal | null } | null>(null);

function cellMeal(date: string, slot: MealSlot): Meal | null {
  return mealByCell.value[`${date}|${slot}`] ?? null;
}
function openCell(date: string, slot: MealSlot) {
  if (!isAdmin.value) return;
  editing.value = { date, slot, meal: cellMeal(date, slot) };
  dialogOpen.value = true;
}
async function onSave(data: UpsertMealInput) {
  await upsertMeal(data);
}
async function onDelete(id: string) {
  await deleteMeal(id);
}

const generating = ref(false);
const genResult = ref("");
async function onGenerate() {
  generating.value = true;
  genResult.value = "";
  try {
    const r = await generateGroceries();
    genResult.value = r.count > 0
      ? `Added ${r.count} item${r.count === 1 ? "" : "s"} to “${r.listName}”.`
      : "No ingredients found in this week's meals.";
  }
  catch {
    genResult.value = "Couldn't generate the grocery list.";
  }
  finally {
    generating.value = false;
  }
}
</script>

<template>
  <div class="flex w-full flex-col">
    <div class="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 border-b border-default bg-default py-4 sm:px-4">
      <div class="flex items-center gap-2">
        <UButton icon="i-lucide-chevron-left" variant="ghost" color="neutral" aria-label="Previous week" @click="prevWeek" />
        <UButton label="This week" variant="soft" color="neutral" size="sm" @click="thisWeek" />
        <UButton icon="i-lucide-chevron-right" variant="ghost" color="neutral" aria-label="Next week" @click="nextWeek" />
        <span class="ml-2 text-sm text-muted">Week of {{ dayLabel(weekStart) }}</span>
      </div>
      <div v-if="isAdmin" class="flex items-center gap-3">
        <span v-if="genResult" class="text-sm text-muted">{{ genResult }}</span>
        <UButton icon="i-lucide-shopping-cart" label="Generate groceries" :loading="generating" @click="onGenerate" />
      </div>
    </div>

    <ClientOnly>
      <div class="overflow-x-auto p-4">
        <div class="grid min-w-[820px] grid-cols-[5rem_repeat(7,minmax(0,1fr))] gap-2">
          <!-- header row -->
          <div />
          <div
            v-for="d in days"
            :key="`h-${d}`"
            class="px-2 pb-1 text-center text-sm font-semibold"
            :class="d === today ? 'text-primary' : ''"
          >
            {{ dayLabel(d) }}
          </div>

          <!-- one row per slot -->
          <template v-for="s in slots" :key="s.key">
            <div class="flex items-center text-sm font-medium text-muted">
              {{ s.label }}
            </div>
            <button
              v-for="d in days"
              :key="`${d}-${s.key}`"
              type="button"
              class="min-h-20 rounded-lg border border-default p-2 text-left align-top transition"
              :class="[
                isAdmin ? 'cursor-pointer hover:bg-elevated' : 'cursor-default',
                d === today ? 'bg-elevated/50' : 'bg-default',
              ]"
              @click="openCell(d, s.key)"
            >
              <template v-if="cellMeal(d, s.key)">
                <p class="text-sm font-medium leading-tight">
                  {{ cellMeal(d, s.key)!.title }}
                </p>
                <p v-if="cellMeal(d, s.key)!.cook || cellMeal(d, s.key)!.time" class="mt-1 text-xs text-muted">
                  <span v-if="cellMeal(d, s.key)!.cook">👨‍🍳 {{ cellMeal(d, s.key)!.cook!.name }}</span>
                  <span v-if="cellMeal(d, s.key)!.time"> · {{ cellMeal(d, s.key)!.time }}</span>
                </p>
              </template>
              <span v-else-if="isAdmin" class="text-xs text-muted">+ Add</span>
            </button>
          </template>
        </div>
      </div>
      <template #fallback>
        <div class="p-4 text-muted">
          Loading meal plan…
        </div>
      </template>
    </ClientOnly>

    <MealDialog
      v-if="editing"
      :is-open="dialogOpen"
      :date="editing.date"
      :meal-slot="editing.slot"
      :meal="editing.meal"
      :users="users ?? []"
      @close="dialogOpen = false"
      @save="onSave"
      @delete="onDelete"
    />
  </div>
</template>
