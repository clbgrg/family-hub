<script setup lang="ts">
const { user } = useUserSession();
const isAdmin = computed(() => user.value?.role === "ADMIN");
const { gate } = useAdminGate();
const { documents, upload, remove } = useDocuments();

const fileInput = ref<HTMLInputElement | null>(null);
const uploading = ref(false);
const error = ref<string | null>(null);

async function onPick(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file)
    return;
  error.value = null;
  uploading.value = true;
  try {
    await gate(() => upload(file));
  }
  catch (err) {
    error.value = (err as { data?: { statusMessage?: string } })?.data?.statusMessage || "Upload failed";
  }
  finally {
    uploading.value = false;
    input.value = "";
  }
}
async function onDelete(id: string) {
  await gate(() => remove(id));
}

function fmtSize(n: number) {
  if (n < 1024)
    return `${n} B`;
  if (n < 1024 * 1024)
    return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
function iconFor(type: string) {
  if (type.startsWith("image/"))
    return "i-lucide-image";
  if (type.includes("sheet") || type.includes("excel") || type === "text/csv")
    return "i-lucide-table";
  return "i-lucide-file-text";
}
</script>

<template>
  <div class="flex w-full flex-col">
    <div class="sticky top-0 z-40 flex items-center justify-between gap-4 border-b border-default bg-default px-4 py-5">
      <h1 class="text-2xl font-bold">
        Documents
      </h1>
      <div v-if="isAdmin">
        <input
          ref="fileInput"
          type="file"
          class="hidden"
          @change="onPick"
        >
        <UButton
          icon="i-lucide-upload"
          :loading="uploading"
          @click="fileInput?.click()"
        >
          Upload
        </UButton>
      </div>
    </div>

    <ClientOnly>
      <p v-if="error" class="mx-4 mt-4 rounded-md bg-error/10 px-3 py-2 text-sm text-error">
        {{ error }}
      </p>
      <ul v-if="documents.length" class="flex flex-col gap-2 p-4">
        <li
          v-for="d in documents"
          :key="d.id"
          class="flex items-center gap-3 rounded-lg border border-default p-3"
        >
          <UIcon :name="iconFor(d.type)" class="size-6 shrink-0 text-primary" />
          <a
            :href="d.url"
            target="_blank"
            rel="noopener"
            class="min-w-0 flex-1 truncate font-medium hover:underline"
          >{{ d.name }}</a>
          <span class="shrink-0 text-xs text-muted">{{ fmtSize(d.size) }}</span>
          <UButton
            v-if="isAdmin"
            icon="i-lucide-trash"
            size="xs"
            variant="ghost"
            color="error"
            aria-label="Delete document"
            @click="onDelete(d.id)"
          />
        </li>
      </ul>
      <p v-else class="p-8 text-center text-muted">
        No documents yet.<template v-if="isAdmin">
          Upload one to get started.
        </template>
      </p>
      <template #fallback>
        <div class="p-4 text-muted">
          Loading…
        </div>
      </template>
    </ClientOnly>
  </div>
</template>
