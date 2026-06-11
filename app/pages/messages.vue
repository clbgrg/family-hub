<script setup lang="ts">
import type { Message } from "~/composables/useMessages";

const { user } = useUserSession();
const { messages, postMessage, deleteMessage } = useMessages();

const requestFetch = useRequestFetch();
const { data: users } = await useAsyncData(
  "messages-users",
  () => requestFetch<{ id: string; name: string }[]>("/api/users"),
  { default: () => [], server: false },
);
const fromOptions = computed(() => (users.value ?? []).map(u => ({ label: u.name, value: u.id })));

const draft = ref("");
const fromId = ref("");
const posting = ref(false);
const postError = ref("");

// Default the "From" picker to the current user once the session resolves.
watchEffect(() => {
  if (!fromId.value && user.value?.id)
    fromId.value = user.value.id;
});

async function submit() {
  const body = draft.value.trim();
  if (!body || posting.value)
    return;
  posting.value = true;
  postError.value = "";
  try {
    await postMessage(body, fromId.value || undefined);
    draft.value = "";
  }
  catch (err) {
    const e = err as { statusMessage?: string; data?: { statusMessage?: string } };
    postError.value = e?.statusMessage || e?.data?.statusMessage || "Couldn't post your note.";
  }
  finally {
    posting.value = false;
  }
}

async function remove(m: Message) {
  await deleteMessage(m.id);
}

function noteStyle(m: Message) {
  const bg = m.author.color || "#fde68a"; // default sticky-note yellow
  return { backgroundColor: bg, color: contrastText(bg) };
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1)
    return "just now";
  if (min < 60)
    return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24)
    return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}
</script>

<template>
  <div class="flex w-full flex-col">
    <div class="sticky top-0 z-40 border-b border-default bg-default py-4 sm:px-4">
      <h1 class="text-xl font-bold">
        Family Board
      </h1>
    </div>

    <div class="mx-auto w-full max-w-5xl p-4">
      <!-- Post a note -->
      <div class="mb-6 flex flex-col gap-2 rounded-lg border border-default p-3">
        <UTextarea
          v-model="draft"
          :rows="2"
          autoresize
          placeholder="Leave a note for the family…"
          class="w-full"
          :ui="{ base: 'w-full' }"
          @keydown.enter.meta.prevent="submit"
          @keydown.enter.ctrl.prevent="submit"
        />
        <div class="flex items-center justify-between gap-3">
          <span class="text-sm text-error">{{ postError }}</span>
          <div class="ml-auto flex items-center gap-2">
            <span class="text-sm text-muted">From</span>
            <USelect
              v-model="fromId"
              :items="fromOptions"
              option-attribute="label"
              value-attribute="value"
              class="w-32"
            />
            <UButton
              label="Post"
              icon="i-lucide-send"
              :loading="posting"
              :disabled="!draft.trim()"
              @click="submit"
            />
          </div>
        </div>
      </div>

      <ClientOnly>
        <div v-if="messages.length" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="m in messages"
            :key="m.id"
            class="relative flex min-h-32 flex-col rounded-lg p-4 shadow-sm"
            :style="noteStyle(m)"
          >
            <UButton
              icon="i-lucide-x"
              size="sm"
              variant="soft"
              color="neutral"
              class="absolute right-1.5 top-1.5"
              aria-label="Delete note"
              @click="remove(m)"
            />
            <p class="flex-1 whitespace-pre-wrap break-words pr-5 text-lg leading-snug">
              {{ m.body }}
            </p>
            <p class="mt-3 text-sm opacity-80">
              — {{ m.author.name }} · {{ timeAgo(m.createdAt) }}
            </p>
          </div>
        </div>
        <div v-else class="py-16 text-center text-muted">
          No notes yet. Be the first to post one! 📌
        </div>
        <template #fallback>
          <div class="py-16 text-center text-muted">
            Loading the board…
          </div>
        </template>
      </ClientOnly>
    </div>
  </div>
</template>
