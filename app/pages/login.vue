<script setup lang="ts">
definePageMeta({ layout: false });

type PickUser = {
  id: string;
  name: string;
  avatar: string | null;
  color: string | null;
  role: string;
  hasPin: boolean;
};

const { fetch: refreshSession } = useUserSession();
const { data: users } = await useFetch<PickUser[]>("/api/auth/users", {
  default: () => [],
});

const selected = ref<PickUser | null>(null);
const pin = ref("");
const error = ref("");
const loading = ref(false);

async function selectUser(u: PickUser) {
  // Kid tap-in: members without a PIN sign in by just picking their profile.
  // (Admins without a PIN stay locked out — a parent profile always needs one.)
  if (!u.hasPin && u.role === "MEMBER") {
    if (loading.value)
      return;
    loading.value = true;
    error.value = "";
    try {
      await $fetch("/api/auth/login", {
        method: "POST",
        body: { userId: u.id },
      });
      await refreshSession();
      await navigateTo("/");
    }
    catch {
      error.value = "Couldn't sign in. Try again.";
    }
    finally {
      loading.value = false;
    }
    return;
  }
  if (!u.hasPin)
    return;
  selected.value = u;
  pin.value = "";
  error.value = "";
}

function back() {
  selected.value = null;
  pin.value = "";
  error.value = "";
}

async function submit() {
  if (!selected.value || pin.value.length < 4 || loading.value)
    return;
  loading.value = true;
  error.value = "";
  try {
    await $fetch("/api/auth/login", {
      method: "POST",
      body: { userId: selected.value.id, pin: pin.value },
    });
    await refreshSession();
    await navigateTo("/");
  }
  catch {
    error.value = "Incorrect PIN. Try again.";
    pin.value = "";
  }
  finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
    <h1 class="text-3xl font-bold">
      Family Hub
    </h1>

    <!-- Step 1: pick who you are -->
    <div v-if="!selected" class="flex max-w-3xl flex-col items-center gap-4">
      <p class="text-muted">
        Who's signing in?
      </p>
      <div class="flex flex-wrap items-center justify-center gap-4">
        <button
          v-for="u in users"
          :key="u.id"
          type="button"
          class="flex flex-col items-center gap-2 rounded-xl p-4 transition hover:bg-elevated disabled:opacity-40"
          :disabled="!u.hasPin && u.role !== 'MEMBER'"
          @click="selectUser(u)"
        >
          <UAvatar
            :src="u.avatar || undefined"
            :alt="u.name"
            size="3xl"
          />
          <span class="text-lg font-medium">{{ u.name }}</span>
          <span v-if="u.hasPin" class="text-xs text-muted"><UIcon name="i-lucide-lock" class="inline size-3" /> PIN</span>
          <span v-else-if="u.role !== 'MEMBER'" class="text-xs text-muted">no PIN set</span>
        </button>
        <p v-if="users.length === 0" class="text-muted">
          No accounts yet.
        </p>
      </div>
      <p v-if="error" class="text-sm text-error">
        {{ error }}
      </p>
    </div>

    <!-- Step 2: enter PIN -->
    <div v-else class="flex flex-col items-center gap-6">
      <div class="flex flex-col items-center gap-1">
        <UAvatar
          :src="selected.avatar || undefined"
          :alt="selected.name"
          size="2xl"
        />
        <span class="text-xl font-semibold">{{ selected.name }}</span>
      </div>
      <AuthPinPad v-model="pin" @submit="submit" />
      <p v-if="error" class="text-sm text-error">
        {{ error }}
      </p>
      <UButton
        variant="link"
        color="neutral"
        label="← Back"
        @click="back"
      />
    </div>
  </div>
</template>
