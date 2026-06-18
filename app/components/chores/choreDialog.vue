<script setup lang="ts">
import type { ChoreBoardItem, ChoreRecurrence, CreateChoreInput } from "~/composables/useChores";

const props = defineProps<{
  isOpen: boolean;
  chore?: ChoreBoardItem | null;
  users: { id: string; name: string }[];
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", data: CreateChoreInput): void;
  (e: "delete", id: string): void;
}>();

const title = ref("");
const description = ref("");
const points = ref(5);
const assigneeIds = ref<string[]>([]);
const recurrence = ref<ChoreRecurrence>("DAILY");
const daysOfWeek = ref<number[]>([]);
const areaId = ref("");
const startDate = ref("");
const endDate = ref("");
const pausedUntil = ref("");
const rotate = ref(false);
const claimable = ref(false);
const rewardId = ref("");
const error = ref<string | null>(null);

const { areas } = useAreas();
const { rewards } = useRewards();
const rewardOptions = computed(() => [
  { label: "No reward", value: "" },
  ...(rewards.value ?? []).filter(r => r.active).map(r => ({ label: r.name, value: r.id })),
]);
const areaOptions = computed(() => [
  { label: "No area", value: "" },
  ...(areas.value ?? []).map(a => ({
    label: a.icon && !a.icon.startsWith("i-") ? `${a.icon} ${a.name}` : a.name,
    value: a.id,
  })),
]);

const recurrenceOptions = [
  { label: "Every day", value: "DAILY" },
  { label: "Certain days", value: "WEEKLY" },
  { label: "One time", value: "ONCE" },
];
const dayChips = [
  { label: "Su", value: 0 },
  { label: "Mo", value: 1 },
  { label: "Tu", value: 2 },
  { label: "We", value: 3 },
  { label: "Th", value: 4 },
  { label: "Fr", value: 5 },
  { label: "Sa", value: 6 },
];
const watchSource = computed(() => ({ isOpen: props.isOpen, chore: props.chore }));
watch(
  watchSource,
  ({ isOpen, chore }) => {
    if (!isOpen)
      return;
    title.value = chore?.title ?? "";
    description.value = chore?.description ?? "";
    points.value = chore?.points ?? 5;
    assigneeIds.value = chore?.assigneeIds?.length
      ? [...chore.assigneeIds]
      : (props.users[0] ? [props.users[0].id] : []);
    recurrence.value = chore?.recurrence ?? "DAILY";
    daysOfWeek.value = chore?.daysOfWeek ? [...chore.daysOfWeek] : [];
    areaId.value = chore?.area?.id ?? "";
    startDate.value = chore?.startDate ?? "";
    endDate.value = chore?.endDate ?? "";
    pausedUntil.value = chore?.pausedUntil ?? "";
    rotate.value = chore?.rotate ?? false;
    claimable.value = chore?.claimable ?? false;
    rewardId.value = chore?.reward?.id ?? "";
    error.value = null;
  },
  { immediate: true },
);

function toggleDay(d: number) {
  daysOfWeek.value = daysOfWeek.value.includes(d)
    ? daysOfWeek.value.filter(x => x !== d)
    : [...daysOfWeek.value, d];
}

function toggleAssignee(id: string) {
  assigneeIds.value = assigneeIds.value.includes(id)
    ? assigneeIds.value.filter(x => x !== id)
    : [...assigneeIds.value, id];
}

function handleSave() {
  if (!title.value.trim()) {
    error.value = "Chore name is required";
    return;
  }
  if (assigneeIds.value.length === 0) {
    error.value = "Choose who it's for";
    return;
  }
  if (recurrence.value === "WEEKLY" && daysOfWeek.value.length === 0) {
    error.value = "Pick at least one day";
    return;
  }
  emit("save", {
    title: title.value.trim(),
    description: description.value.trim(),
    points: Math.max(0, Number(points.value) || 0),
    recurrence: recurrence.value,
    daysOfWeek: daysOfWeek.value,
    assigneeIds: assigneeIds.value,
    areaId: areaId.value || null,
    startDate: startDate.value || null,
    endDate: endDate.value || null,
    pausedUntil: pausedUntil.value || null,
    rotate: rotate.value,
    claimable: claimable.value,
    rewardId: rewardId.value || null,
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
          {{ chore?.id ? "Edit Chore" : "Add Chore" }}
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
          <label class="block text-sm font-medium text-highlighted">Chore</label>
          <UInput
            v-model="title"
            placeholder="e.g. Make your bed"
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

        <div class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">Area (optional)</label>
          <USelect
            v-model="areaId"
            :items="areaOptions"
            option-attribute="label"
            value-attribute="value"
            class="w-full"
            :ui="{ base: 'w-full' }"
          />
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">Reward (optional)</label>
          <USelect
            v-model="rewardId"
            :items="rewardOptions"
            option-attribute="label"
            value-attribute="value"
            class="w-full"
            :ui="{ base: 'w-full' }"
          />
          <p class="text-xs text-muted">
            Completing it queues this reward for a parent to approve — separate from points.
          </p>
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">For</label>
          <p class="text-xs text-muted">
            Pick one or more — each person checks off their own copy and earns the points.
          </p>
          <div class="flex flex-wrap gap-1">
            <UButton
              v-for="u in users"
              :key="u.id"
              :label="u.name"
              size="sm"
              :variant="assigneeIds.includes(u.id) ? 'solid' : 'outline'"
              :color="assigneeIds.includes(u.id) ? 'primary' : 'neutral'"
              @click="toggleAssignee(u.id)"
            />
          </div>
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">Repeats</label>
          <USelect
            v-model="recurrence"
            :items="recurrenceOptions"
            option-attribute="label"
            value-attribute="value"
            class="w-full"
            :ui="{ base: 'w-full' }"
          />
        </div>

        <div v-if="recurrence === 'WEEKLY'" class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">On these days</label>
          <div class="flex gap-1">
            <UButton
              v-for="d in dayChips"
              :key="d.value"
              :label="d.label"
              size="sm"
              :variant="daysOfWeek.includes(d.value) ? 'solid' : 'outline'"
              :color="daysOfWeek.includes(d.value) ? 'primary' : 'neutral'"
              @click="toggleDay(d.value)"
            />
          </div>
        </div>

        <div v-if="assigneeIds.length > 1" class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <label class="block text-sm font-medium text-highlighted">Rotate between assignees</label>
            <p class="text-xs text-muted">
              One person's turn at a time (daily or weekly) instead of everyone.
            </p>
          </div>
          <UCheckbox v-model="rotate" />
        </div>

        <div v-if="assigneeIds.length > 1" class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <label class="block text-sm font-medium text-highlighted">Up for grabs</label>
            <p class="text-xs text-muted">
              Anyone in the list can claim it — first to do it gets the credit.
            </p>
          </div>
          <UCheckbox v-model="claimable" />
        </div>

        <div class="flex gap-4">
          <div class="flex-1 space-y-2">
            <label class="block text-sm font-medium text-highlighted">Start date</label>
            <UInput
              v-model="startDate"
              type="date"
              class="w-full"
              :ui="{ base: 'w-full' }"
            />
          </div>
          <div class="flex-1 space-y-2">
            <label class="block text-sm font-medium text-highlighted">End date</label>
            <UInput
              v-model="endDate"
              type="date"
              class="w-full"
              :ui="{ base: 'w-full' }"
            />
          </div>
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">Pause until</label>
          <UInput
            v-model="pausedUntil"
            type="date"
            class="w-full"
            :ui="{ base: 'w-full' }"
          />
          <p class="text-xs text-muted">
            Hidden from the board until this date — handy for vacations.
          </p>
        </div>
      </div>

      <div class="flex justify-between border-t border-default p-4">
        <UButton
          v-if="chore?.id"
          color="error"
          variant="ghost"
          icon="i-lucide-trash"
          @click="emit('delete', chore.id); emit('close')"
        >
          Delete
        </UButton>
        <div class="flex gap-2" :class="{ 'ml-auto': !chore?.id }">
          <UButton
            color="neutral"
            variant="ghost"
            @click="emit('close')"
          >
            Cancel
          </UButton>
          <UButton color="primary" @click="handleSave">
            {{ chore?.id ? "Save" : "Add Chore" }}
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
