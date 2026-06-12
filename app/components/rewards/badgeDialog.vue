<script setup lang="ts">
import type { BadgeCondition, BadgeDef, BadgeRuleType, CreateBadgeInput } from "~/composables/useBadges";

const props = defineProps<{
  isOpen: boolean;
  badge?: BadgeDef | null;
  users: { id: string; name: string }[];
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", data: CreateBadgeInput): void;
  (e: "delete", id: string): void;
}>();

const name = ref("");
const icon = ref("i-lucide-award");
const description = ref("");
const conditions = ref<BadgeCondition[]>([]);
const appliesToUserIds = ref<string[]>([]);
const errorMsg = ref<string | null>(null);

const ruleOptions: { label: string; value: BadgeRuleType }[] = [
  { label: "Day streak ≥", value: "STREAK" },
  { label: "Total points earned ≥", value: "TOTAL_POINTS" },
  { label: "Total chores + school items done ≥", value: "TOTAL_COMPLETIONS" },
  { label: "Points in one day ≥", value: "POINTS_IN_DAY" },
  { label: "Tasks done before an hour ≥", value: "EARLY_BIRD" },
  { label: "Weekend tasks done ≥", value: "WEEKEND_COMPLETIONS" },
  { label: "Big tasks (≥ X pts each) done ≥", value: "HIGH_VALUE_COMPLETIONS" },
  { label: "Avg points over last X tasks ≥", value: "ROLLING_AVG_POINTS" },
];

// Rules with a second knob: which extra field, its label, bounds, and default.
const EXTRA_PARAMS: Partial<Record<BadgeRuleType, { key: "beforeHour" | "minPoints" | "window"; label: string; min: number; max: number; fallback: number }>> = {
  EARLY_BIRD: { key: "beforeHour", label: "before hour (0–23)", min: 0, max: 23, fallback: 8 },
  HIGH_VALUE_COMPLETIONS: { key: "minPoints", label: "min points each", min: 1, max: 9999, fallback: 20 },
  ROLLING_AVG_POINTS: { key: "window", label: "over last … tasks", min: 1, max: 1000, fallback: 50 },
};

// Switching a row's rule seeds the extra field so the save is always valid.
function onRuleChange(c: BadgeCondition) {
  const extra = EXTRA_PARAMS[c.ruleType];
  if (extra && typeof c[extra.key] !== "number") {
    c[extra.key] = extra.fallback;
  }
}

const watchSource = computed(() => ({ isOpen: props.isOpen, badge: props.badge }));
watch(
  watchSource,
  ({ isOpen, badge }) => {
    if (!isOpen)
      return;
    name.value = badge?.name ?? "";
    icon.value = badge?.icon ?? "i-lucide-award";
    description.value = badge?.description ?? "";
    conditions.value = badge?.conditions?.length
      ? badge.conditions.map(c => ({ ...c }))
      : [{ ruleType: "STREAK", threshold: 7 }];
    appliesToUserIds.value = badge ? [...badge.appliesToUserIds] : [];
    errorMsg.value = null;
  },
  { immediate: true },
);

function addCondition() {
  conditions.value = [...conditions.value, { ruleType: "TOTAL_POINTS", threshold: 100 }];
}
function removeCondition(index: number) {
  conditions.value = conditions.value.filter((_, i) => i !== index);
}
function toggleMember(id: string) {
  appliesToUserIds.value = appliesToUserIds.value.includes(id)
    ? appliesToUserIds.value.filter(x => x !== id)
    : [...appliesToUserIds.value, id];
}

function handleSave() {
  if (!name.value.trim()) {
    errorMsg.value = "Name is required";
    return;
  }
  if (conditions.value.length === 0) {
    errorMsg.value = "Add at least one condition";
    return;
  }
  emit("save", {
    name: name.value.trim(),
    icon: icon.value.trim() || "i-lucide-award",
    description: description.value.trim(),
    conditions: conditions.value.map((c) => {
      const out: BadgeCondition = {
        ruleType: c.ruleType,
        threshold: Math.max(1, Number(c.threshold) || 1),
      };
      const extra = EXTRA_PARAMS[c.ruleType];
      if (extra) {
        const raw = Number(c[extra.key] ?? extra.fallback);
        out[extra.key] = Math.min(extra.max, Math.max(extra.min, Number.isFinite(raw) ? Math.round(raw) : extra.fallback));
      }
      return out;
    }),
    appliesToUserIds: appliesToUserIds.value,
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
      class="w-[500px] max-h-[90vh] overflow-y-auto rounded-lg border border-default bg-default shadow-lg"
      @click.stop
    >
      <div class="flex items-center justify-between border-b border-default p-4">
        <h3 class="text-base font-semibold leading-6">
          {{ badge?.id ? "Edit Badge" : "Add Badge" }}
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
          <label class="block text-sm font-medium text-highlighted">Name</label>
          <UInput
            v-model="name"
            placeholder="e.g. Super Streak"
            class="w-full"
            :ui="{ base: 'w-full' }"
          />
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">Icon</label>
          <div class="flex items-center gap-2">
            <UIcon :name="icon || 'i-lucide-award'" class="size-6 text-primary" />
            <UInput
              v-model="icon"
              placeholder="i-lucide-trophy"
              class="flex-1"
              :ui="{ base: 'w-full' }"
            />
          </div>
          <p class="text-xs text-muted">
            Any <a
              href="https://lucide.dev/icons"
              target="_blank"
              class="underline"
            >Lucide</a> name, e.g. i-lucide-trophy.
          </p>
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">Description (optional)</label>
          <UInput
            v-model="description"
            placeholder="What it's for"
            class="w-full"
            :ui="{ base: 'w-full' }"
          />
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="block text-sm font-medium text-highlighted">Earned when (all must be met)</label>
            <UButton
              icon="i-lucide-plus"
              size="xs"
              variant="soft"
              color="neutral"
              label="Add condition"
              @click="addCondition"
            />
          </div>
          <div
            v-for="(c, i) in conditions"
            :key="i"
            class="space-y-1"
          >
            <div class="flex items-center gap-2">
              <USelect
                v-model="c.ruleType"
                :items="ruleOptions"
                option-attribute="label"
                value-attribute="value"
                class="flex-1"
                :ui="{ base: 'w-full' }"
                @update:model-value="onRuleChange(c)"
              />
              <UInput
                v-model.number="c.threshold"
                type="number"
                :min="1"
                class="w-24"
                :ui="{ base: 'w-full' }"
              />
              <UButton
                v-if="conditions.length > 1"
                icon="i-lucide-x"
                size="xs"
                variant="ghost"
                color="neutral"
                aria-label="Remove condition"
                @click="removeCondition(i)"
              />
            </div>
            <div v-if="EXTRA_PARAMS[c.ruleType]" class="flex items-center justify-end gap-2">
              <span class="text-xs text-muted">{{ EXTRA_PARAMS[c.ruleType]!.label }}</span>
              <UInput
                v-model.number="c[EXTRA_PARAMS[c.ruleType]!.key]"
                type="number"
                :min="EXTRA_PARAMS[c.ruleType]!.min"
                :max="EXTRA_PARAMS[c.ruleType]!.max"
                class="w-24"
                :ui="{ base: 'w-full' }"
              />
            </div>
          </div>
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">Who can earn it</label>
          <p class="text-xs text-muted">
            Nobody selected = everyone can earn it.
          </p>
          <div class="flex flex-wrap gap-1">
            <UButton
              v-for="u in users"
              :key="u.id"
              :label="u.name"
              size="sm"
              :variant="appliesToUserIds.includes(u.id) ? 'solid' : 'outline'"
              :color="appliesToUserIds.includes(u.id) ? 'primary' : 'neutral'"
              @click="toggleMember(u.id)"
            />
          </div>
        </div>
      </div>

      <div class="flex justify-between border-t border-default p-4">
        <UButton
          v-if="badge?.id"
          color="error"
          variant="ghost"
          icon="i-lucide-trash"
          @click="emit('delete', badge.id); emit('close')"
        >
          Delete
        </UButton>
        <div class="flex gap-2" :class="{ 'ml-auto': !badge?.id }">
          <UButton
            color="neutral"
            variant="ghost"
            @click="emit('close')"
          >
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
