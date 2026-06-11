<script setup lang="ts">
definePageMeta({ layout: false });

// First-run: create the first admin (a parent). Name → PIN → confirm PIN.
type Stage = "name" | "pin" | "confirm";

const { fetch: refreshSession } = useUserSession();

const stage = ref<Stage>("name");
const name = ref("");
const pin = ref("");
const confirmPin = ref("");
const error = ref("");
const loading = ref(false);

function toPin() {
  if (name.value.trim().length === 0) {
    error.value = "Please enter a name.";
    return;
  }
  error.value = "";
  stage.value = "pin";
}

function toConfirm() {
  if (pin.value.length < 4) {
    error.value = "PIN must be at least 4 digits.";
    return;
  }
  error.value = "";
  stage.value = "confirm";
}

async function finish() {
  if (confirmPin.value !== pin.value) {
    error.value = "PINs didn't match. Let's try again.";
    pin.value = "";
    confirmPin.value = "";
    stage.value = "pin";
    return;
  }
  if (loading.value)
    return;
  loading.value = true;
  error.value = "";
  try {
    await $fetch("/api/auth/setup", {
      method: "POST",
      body: { name: name.value.trim(), pin: pin.value },
    });
    await refreshSession();
    await navigateTo("/");
  }
  catch (err) {
    const e = err as { statusMessage?: string };
    error.value = e?.statusMessage || "Setup failed. Please try again.";
    loading.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
    <div class="flex flex-col items-center gap-1 text-center">
      <h1 class="text-3xl font-bold">
        Welcome to Family Hub
      </h1>
      <p class="text-muted">
        Let's create your parent (admin) account.
      </p>
    </div>

    <!-- Step 1: name -->
    <div v-if="stage === 'name'" class="flex w-full max-w-sm flex-col items-center gap-4">
      <UInput
        v-model="name"
        size="xl"
        placeholder="Your name"
        class="w-full"
        autofocus
        @keyup.enter="toPin"
      />
      <UButton
        size="xl"
        label="Next"
        block
        @click="toPin"
      />
    </div>

    <!-- Step 2: choose PIN -->
    <div v-else-if="stage === 'pin'" class="flex flex-col items-center gap-6">
      <p class="text-lg">
        Choose a PIN (4–8 digits)
      </p>
      <AuthPinPad v-model="pin" @submit="toConfirm" />
      <UButton
        variant="link"
        color="neutral"
        label="← Back"
        @click="stage = 'name'"
      />
    </div>

    <!-- Step 3: confirm PIN -->
    <div v-else class="flex flex-col items-center gap-6">
      <p class="text-lg">
        Confirm your PIN
      </p>
      <AuthPinPad v-model="confirmPin" @submit="finish" />
    </div>

    <p v-if="error" class="text-sm text-error">
      {{ error }}
    </p>
  </div>
</template>
