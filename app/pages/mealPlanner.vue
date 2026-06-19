<script setup lang="ts">
import type { Meal, MealSlot, UpsertMealInput } from "~/composables/useMeals";
import type { CreateSavedMealInput, SavedMeal } from "~/composables/useSavedMeals";

const { user } = useUserSession();
const isAdmin = computed(() => user.value?.role === "ADMIN");

const weekStart = ref(weekStartSunday(isoToday()));
const { mealByCell, upsertMeal, deleteMeal, generateGroceries } = useMeals(weekStart);
const { savedMeals, createSavedMeal, updateSavedMeal, deleteSavedMeal } = useSavedMeals();

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
  if (!isAdmin.value)
    return;
  editing.value = { date, slot, meal: cellMeal(date, slot) };
  dialogOpen.value = true;
}
async function onSave(data: UpsertMealInput) {
  await upsertMeal(data);
}
async function onDelete(id: string) {
  await deleteMeal(id);
}

// --- Saved meals: drag a card onto a day cell (or pick one in the dialog) ---
const savedDialogOpen = ref(false);
// When set, the saved-meal dialog edits this meal; null means create a new one.
const savedEditing = ref<SavedMeal | null>(null);

function openSavedCreate() {
  savedEditing.value = null;
  savedDialogOpen.value = true;
}
function openSavedEdit(meal: SavedMeal) {
  savedEditing.value = meal;
  savedDialogOpen.value = true;
}

function onSavedDragStart(e: DragEvent, meal: SavedMeal) {
  e.dataTransfer?.setData("application/x-saved-meal", meal.id);
  if (e.dataTransfer)
    e.dataTransfer.effectAllowed = "copy";
}
async function onCellDrop(date: string, slot: MealSlot, e: DragEvent) {
  if (!isAdmin.value)
    return;
  const id = e.dataTransfer?.getData("application/x-saved-meal");
  const saved = (savedMeals.value ?? []).find(m => m.id === id);
  if (!saved)
    return;
  await upsertMeal({
    date,
    slot,
    title: saved.title,
    notes: saved.notes ?? "",
    ingredients: saved.ingredients ?? "",
  });
}
async function onSavedMealCreate(data: CreateSavedMealInput) {
  await createSavedMeal(data);
}
async function onSavedMealSave(data: CreateSavedMealInput) {
  if (savedEditing.value)
    await updateSavedMeal(savedEditing.value.id, data);
  else
    await createSavedMeal(data);
}

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function dayAbbr(d: number) {
  return DAY_ABBR[d] ?? "";
}

// Quick-add a saved meal to its usual days in the week being viewed (dinner by
// default — tweak any cell afterward). weekStart is a Sunday, so a weekday
// index maps straight onto days[d].
async function quickAddToWeek(meal: SavedMeal) {
  for (const d of meal.defaultDays) {
    const date = days.value[d];
    if (!date)
      continue;
    await upsertMeal({ date, slot: "DINNER", title: meal.title, notes: meal.notes ?? "", ingredients: meal.ingredients ?? "" });
  }
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
        <UButton
          icon="i-lucide-chevron-left"
          variant="ghost"
          color="neutral"
          aria-label="Previous week"
          @click="prevWeek"
        />
        <UButton
          label="This week"
          variant="soft"
          color="neutral"
          size="sm"
          @click="thisWeek"
        />
        <UButton
          icon="i-lucide-chevron-right"
          variant="ghost"
          color="neutral"
          aria-label="Next week"
          @click="nextWeek"
        />
        <span class="ml-2 text-sm text-muted">Week of {{ dayLabel(weekStart) }}</span>
      </div>
      <div v-if="isAdmin" class="flex items-center gap-3">
        <span v-if="genResult" class="text-sm text-muted">{{ genResult }}</span>
        <UButton
          icon="i-lucide-shopping-cart"
          label="Generate groceries"
          :loading="generating"
          @click="onGenerate"
        />
      </div>
    </div>

    <ClientOnly>
      <div class="flex flex-col gap-4 p-4 xl:flex-row">
        <div class="min-w-0 flex-1 overflow-x-auto">
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
                @dragover.prevent
                @drop.prevent="onCellDrop(d, s.key, $event)"
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

        <!-- Saved meals repository: drag a card onto a day (admins) -->
        <div class="w-full shrink-0 xl:w-64">
          <div class="rounded-lg border border-default">
            <div class="flex items-center justify-between border-b border-default p-3">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-bookmark" class="size-4 text-primary" />
                <h2 class="text-sm font-semibold">
                  Saved meals
                </h2>
              </div>
              <UButton
                v-if="isAdmin"
                icon="i-lucide-plus"
                size="xs"
                variant="soft"
                aria-label="Save a meal"
                @click="openSavedCreate"
              />
            </div>
            <ul v-if="(savedMeals ?? []).length" class="flex flex-col gap-1 p-2">
              <li
                v-for="m in savedMeals"
                :key="m.id"
                class="group flex items-center gap-2 rounded-md border border-default bg-elevated/40 px-2 py-1.5"
                :class="isAdmin ? 'cursor-grab active:cursor-grabbing' : ''"
                :draggable="isAdmin"
                @dragstart="onSavedDragStart($event, m)"
              >
                <UIcon name="i-lucide-grip-vertical" class="size-3.5 shrink-0 text-muted" />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium">
                    {{ m.title }}
                  </p>
                  <p v-if="m.ingredients" class="truncate text-xs text-muted">
                    {{ m.ingredients.split("\n").length }} ingredient{{ m.ingredients.split("\n").length === 1 ? "" : "s" }}
                  </p>
                  <p v-if="m.defaultDays.length" class="truncate text-xs text-primary">
                    {{ m.defaultDays.map(dayAbbr).join(", ") }}
                  </p>
                </div>
                <UButton
                  v-if="isAdmin && m.defaultDays.length"
                  icon="i-lucide-calendar-plus"
                  size="xs"
                  variant="ghost"
                  color="primary"
                  class="opacity-0 transition group-hover:opacity-100"
                  :aria-label="`Add ${m.title} to this week`"
                  @click="quickAddToWeek(m)"
                />
                <UButton
                  v-if="isAdmin"
                  icon="i-lucide-pencil"
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  class="opacity-0 transition group-hover:opacity-100"
                  :aria-label="`Edit ${m.title}`"
                  @click="openSavedEdit(m)"
                />
                <UButton
                  v-if="isAdmin"
                  icon="i-lucide-x"
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  class="opacity-0 transition group-hover:opacity-100"
                  :aria-label="`Delete ${m.title}`"
                  @click="deleteSavedMeal(m.id)"
                />
              </li>
            </ul>
            <p v-else class="p-3 text-xs text-muted">
              {{ isAdmin ? "Save a meal once, then drag it onto any day — no retyping." : "No saved meals yet." }}
            </p>
          </div>
        </div>
      </div>
      <template #fallback>
        <div class="p-4 text-muted">
          Loading meal plan…
        </div>
      </template>
    </ClientOnly>

    <SavedMealDialog
      :is-open="savedDialogOpen"
      :meal="savedEditing"
      @close="savedDialogOpen = false"
      @save="onSavedMealSave"
    />

    <MealDialog
      v-if="editing"
      :is-open="dialogOpen"
      :date="editing.date"
      :meal-slot="editing.slot"
      :meal="editing.meal"
      :users="users ?? []"
      :saved-meals="savedMeals ?? []"
      @close="dialogOpen = false"
      @save="onSave"
      @delete="onDelete"
      @save-to-repo="onSavedMealCreate"
    />
  </div>
</template>
