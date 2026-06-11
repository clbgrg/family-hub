<script setup lang="ts">
import AuthPinPad from "~/components/auth/authPinPad.vue";

// Single shared instance (mounted in app.vue); state lives in useAdminGate.
const { promptOpen, submitPin, settlePrompt } = useAdminGate();

const pin = ref("");
const error = ref("");
const checking = ref(false);

watch(promptOpen, (open) => {
  if (open) {
    pin.value = "";
    error.value = "";
  }
});

async function onSubmit() {
  if (checking.value || pin.value.length < 4)
    return;
  checking.value = true;
  error.value = "";
  const ok = await submitPin(pin.value);
  checking.value = false;
  if (ok) {
    settlePrompt(true);
  }
  else {
    pin.value = "";
    error.value = "Wrong PIN — try again.";
  }
}

function onCancel() {
  settlePrompt(false);
}
</script>

<template>
  <div
    v-if="promptOpen"
    class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
    @click="onCancel"
  >
    <div
      class="w-[380px] rounded-lg border border-default bg-default shadow-lg"
      @click.stop
    >
      <div class="flex items-center justify-between border-b border-default p-4">
        <div>
          <h3 class="text-base font-semibold leading-6">
            Parent unlock
          </h3>
          <p class="text-sm text-muted">
            Enter a parent PIN to make changes.
          </p>
        </div>
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-x"
          aria-label="Cancel"
          @click="onCancel"
        />
      </div>

      <div class="flex flex-col items-center gap-4 p-6">
        <AuthPinPad v-model="pin" @submit="onSubmit" />
        <p v-if="error" class="text-sm text-error">
          {{ error }}
        </p>
      </div>
    </div>
  </div>
</template>
