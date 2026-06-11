<script setup lang="ts">
import type { CreateRewardInput, Reward } from "~/composables/useRewards";

const props = defineProps<{
  isOpen: boolean;
  reward?: Reward | null;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", data: CreateRewardInput): void;
  (e: "delete", id: string): void;
}>();

const name = ref("");
const pointsCost = ref(10);
const imageUrl = ref("");
const errorMsg = ref<string | null>(null);

const watchSource = computed(() => ({ isOpen: props.isOpen, reward: props.reward }));
watch(
  watchSource,
  ({ isOpen, reward }) => {
    if (!isOpen)
      return;
    name.value = reward?.name ?? "";
    pointsCost.value = reward?.pointsCost ?? 10;
    imageUrl.value = reward?.imageUrl ?? "";
    errorMsg.value = null;
  },
  { immediate: true },
);

function handleSave() {
  if (!name.value.trim()) {
    errorMsg.value = "Name is required";
    return;
  }
  emit("save", {
    name: name.value.trim(),
    pointsCost: Math.max(0, Number(pointsCost.value) || 0),
    imageUrl: imageUrl.value.trim(),
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
      class="w-[440px] max-h-[90vh] overflow-y-auto rounded-lg border border-default bg-default shadow-lg"
      @click.stop
    >
      <div class="flex items-center justify-between border-b border-default p-4">
        <h3 class="text-base font-semibold leading-6">
          {{ reward?.id ? "Edit Reward" : "Add Reward" }}
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
          <label class="block text-sm font-medium text-highlighted">Reward</label>
          <UInput
            v-model="name"
            placeholder="e.g. Movie night"
            class="w-full"
            :ui="{ base: 'w-full' }"
            @keyup.enter="handleSave"
          />
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">Cost (points)</label>
          <UInput
            v-model.number="pointsCost"
            type="number"
            :min="0"
            class="w-full"
            :ui="{ base: 'w-full' }"
          />
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">Image URL (optional)</label>
          <UInput
            v-model="imageUrl"
            type="url"
            placeholder="Paste an image link"
            class="w-full"
            :ui="{ base: 'w-full' }"
          />
        </div>
      </div>

      <div class="flex justify-between border-t border-default p-4">
        <UButton
          v-if="reward?.id"
          color="error"
          variant="ghost"
          icon="i-lucide-trash"
          @click="emit('delete', reward.id); emit('close')"
        >
          Delete
        </UButton>
        <div class="flex gap-2" :class="{ 'ml-auto': !reward?.id }">
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
