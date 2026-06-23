<script setup lang="ts">
import type { Area, CreateAreaInput } from "~/composables/useAreas";

const props = defineProps<{
  isOpen: boolean;
  area?: Area | null;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", data: CreateAreaInput): void;
  (e: "delete", id: string): void;
}>();

const name = ref("");
const icon = ref("");
const errorMsg = ref<string | null>(null);

const watchSource = computed(() => ({ isOpen: props.isOpen, area: props.area }));
watch(
  watchSource,
  ({ isOpen, area }) => {
    if (!isOpen)
      return;
    name.value = area?.name ?? "";
    icon.value = area?.icon ?? "";
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
    icon: icon.value.trim() || null,
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
          {{ area?.id ? "Edit Area" : "Add Area" }}
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
            placeholder="e.g. Kitchen"
            class="w-full"
            :ui="{ base: 'w-full' }"
          />
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">Icon (optional)</label>
          <div class="flex items-center gap-2">
            <span v-if="icon && !icon.startsWith('i-')" class="text-2xl leading-none">{{ icon }}</span>
            <UIcon
              v-else
              :name="icon || areaIconFor(name)"
              class="size-6 text-primary"
            />
            <UInput
              v-model="icon"
              placeholder="🧼 or i-lucide-utensils"
              class="flex-1"
              :ui="{ base: 'w-full' }"
            />
          </div>
          <p class="text-xs text-muted">
            An emoji (🧼, 🛏️, 🪥) or any
            <a
              href="https://lucide.dev/icons"
              target="_blank"
              class="underline"
            >Lucide</a> name. Leave blank to auto-pick an icon from the name.
          </p>
        </div>
      </div>

      <div class="flex justify-between border-t border-default p-4">
        <UButton
          v-if="area?.id"
          color="error"
          variant="ghost"
          icon="i-lucide-trash"
          @click="emit('delete', area.id); emit('close')"
        >
          Delete
        </UButton>
        <div class="flex gap-2" :class="{ 'ml-auto': !area?.id }">
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
