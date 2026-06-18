<script setup lang="ts">
import { formatDistanceToNow } from "date-fns";

import type { PinnedNote } from "~/composables/usePinnedNotes";

const { notes, addNote, updateNote, deleteNote } = usePinnedNotes();

const adding = ref(false);
const draft = ref("");
const busy = ref(false);
const errorMsg = ref("");

const editingId = ref<string | null>(null);
const editBody = ref("");

function errText(err: unknown) {
  const e = err as { statusMessage?: string; data?: { statusMessage?: string } };
  return e?.statusMessage || e?.data?.statusMessage || "Something went wrong.";
}
function timeAgo(iso: string) {
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

async function submitNew() {
  const body = draft.value.trim();
  if (!body || busy.value)
    return;
  busy.value = true;
  errorMsg.value = "";
  try {
    await addNote(body);
    draft.value = "";
    adding.value = false;
  }
  catch (err) {
    errorMsg.value = errText(err);
  }
  finally {
    busy.value = false;
  }
}

function startEdit(n: PinnedNote) {
  editingId.value = n.id;
  editBody.value = n.body;
  errorMsg.value = "";
}
function cancelEdit() {
  editingId.value = null;
  editBody.value = "";
}
async function saveEdit(id: string) {
  const body = editBody.value.trim();
  if (!body || busy.value)
    return;
  busy.value = true;
  errorMsg.value = "";
  try {
    await updateNote(id, body);
    cancelEdit();
  }
  catch (err) {
    errorMsg.value = errText(err);
  }
  finally {
    busy.value = false;
  }
}
async function remove(id: string) {
  if (editingId.value === id)
    cancelEdit();
  await deleteNote(id);
}
</script>

<template>
  <div class="mx-4 mt-4 rounded-lg border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-4">
    <div class="mb-2 flex items-center gap-2">
      <UIcon name="i-lucide-pin" class="size-5 shrink-0 text-primary" />
      <h2 class="font-semibold text-highlighted">
        Family Bulletin
      </h2>
      <UButton
        v-if="!adding"
        icon="i-lucide-plus"
        size="xs"
        variant="soft"
        label="Add note"
        class="ml-auto"
        @click="adding = true"
      />
    </div>

    <!-- New-note composer -->
    <div v-if="adding" class="mb-3 flex flex-col gap-2">
      <UTextarea
        v-model="draft"
        :rows="2"
        autoresize
        placeholder="Pin a note for the family…"
        class="w-full"
        :ui="{ base: 'w-full' }"
        @keydown.enter.meta.prevent="submitNew"
        @keydown.enter.ctrl.prevent="submitNew"
      />
      <div class="flex items-center gap-2">
        <UButton
          label="Pin it"
          icon="i-lucide-pin"
          size="xs"
          :loading="busy"
          :disabled="!draft.trim()"
          @click="submitNew"
        />
        <UButton
          label="Cancel"
          size="xs"
          variant="ghost"
          color="neutral"
          @click="adding = false; draft = ''"
        />
      </div>
    </div>

    <p v-if="errorMsg" class="mb-2 text-sm text-error">
      {{ errorMsg }}
    </p>

    <ul v-if="notes.length" class="flex flex-col gap-2">
      <li
        v-for="n in notes"
        :key="n.id"
        class="rounded-md border border-default bg-elevated p-2.5"
      >
        <!-- Edit mode -->
        <div v-if="editingId === n.id" class="flex flex-col gap-2">
          <UTextarea
            v-model="editBody"
            :rows="2"
            autoresize
            class="w-full"
            :ui="{ base: 'w-full' }"
          />
          <div class="flex items-center gap-2">
            <UButton
              label="Save"
              size="xs"
              :loading="busy"
              :disabled="!editBody.trim()"
              @click="saveEdit(n.id)"
            />
            <UButton
              label="Cancel"
              size="xs"
              variant="ghost"
              color="neutral"
              @click="cancelEdit"
            />
          </div>
        </div>
        <!-- View mode -->
        <template v-else>
          <div class="flex items-start gap-2">
            <p class="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm">
              {{ n.body }}
            </p>
            <div class="flex shrink-0 items-center gap-0.5">
              <UButton
                icon="i-lucide-pencil"
                size="xs"
                variant="ghost"
                color="neutral"
                :aria-label="`Edit note by ${n.author?.name ?? 'unknown'}`"
                @click="startEdit(n)"
              />
              <UButton
                icon="i-lucide-x"
                size="xs"
                variant="ghost"
                color="neutral"
                aria-label="Delete note"
                @click="remove(n.id)"
              />
            </div>
          </div>
          <p class="mt-1 text-xs text-muted">
            <span v-if="n.author">— {{ n.author.name }} · </span>{{ timeAgo(n.createdAt) }}
          </p>
        </template>
      </li>
    </ul>
    <p v-else-if="!adding" class="text-sm text-muted">
      No pinned notes yet — add a reminder, a verse, or a heads-up everyone should see.
    </p>
  </div>
</template>
