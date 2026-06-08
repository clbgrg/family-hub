<script setup lang="ts">
// Numeric PIN pad, kiosk/touch friendly. v-model is the PIN string.
const props = defineProps<{ modelValue: string; max?: number }>();
const emit = defineEmits<{ "update:modelValue": [string]; submit: [] }>();

const max = computed(() => props.max ?? 8);
const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

function press(d: string) {
  if (props.modelValue.length < max.value) emit("update:modelValue", props.modelValue + d);
}
function backspace() {
  emit("update:modelValue", props.modelValue.slice(0, -1));
}
</script>

<template>
  <div class="flex flex-col items-center gap-6">
    <!-- entered-digit dots -->
    <div class="flex h-4 items-center gap-3">
      <span
        v-for="i in modelValue.length"
        :key="i"
        class="size-3.5 rounded-full bg-primary"
      />
      <span v-if="modelValue.length === 0" class="text-sm text-muted">enter PIN</span>
    </div>

    <div class="grid grid-cols-3 gap-3">
      <UButton
        v-for="d in digits"
        :key="d"
        :label="d"
        size="xl"
        variant="soft"
        color="neutral"
        class="size-20 justify-center text-2xl"
        @click="press(d)"
      />
      <UButton
        icon="i-lucide-delete"
        size="xl"
        variant="ghost"
        color="neutral"
        class="size-20 justify-center"
        aria-label="Backspace"
        @click="backspace"
      />
      <UButton
        label="0"
        size="xl"
        variant="soft"
        color="neutral"
        class="size-20 justify-center text-2xl"
        @click="press('0')"
      />
      <UButton
        icon="i-lucide-check"
        size="xl"
        color="primary"
        class="size-20 justify-center"
        aria-label="Submit"
        @click="emit('submit')"
      />
    </div>
  </div>
</template>
