<script setup lang="ts">
import type { ShoppingList } from "~/types/database";

const props = defineProps<{
  isOpen: boolean;
  list?: ShoppingList | null;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const copied = ref(false);
const qrDataUrl = ref<string | null>(null);

// Plain-text version of the list: the unchecked (still-to-buy) items, one per
// line. Falls back to every item if the whole list is already checked off.
const exportText = computed(() => {
  const items = props.list?.items ?? [];
  const active = items.filter(i => !i.checked);
  const lines = (active.length > 0 ? active : items).map((i) => {
    const qty = (i.quantity ?? 1) > 1 ? `${i.quantity} ` : "";
    const unit = i.unit ? `${i.unit} ` : "";
    const notes = i.notes ? ` (${i.notes})` : "";
    return `${qty}${unit}${i.name}${notes}`;
  });
  return lines.join("\n");
});

// Render the QR fresh each time the dialog opens — it encodes the list text
// itself, so a phone can scan it and copy the items straight off the camera.
watch(
  () => props.isOpen,
  async (open) => {
    copied.value = false;
    qrDataUrl.value = null;
    if (open && exportText.value) {
      const QRCode = (await import("qrcode")).default;
      qrDataUrl.value = await QRCode.toDataURL(exportText.value, { width: 220, margin: 1 });
    }
  },
  { immediate: true },
);

async function copyText() {
  await navigator.clipboard.writeText(exportText.value);
  copied.value = true;
  setTimeout(() => (copied.value = false), 2000);
}

function downloadTxt() {
  const blob = new Blob([exportText.value], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(props.list?.name || "shopping-list").replace(/[^\w\- ]+/g, "").trim() || "shopping-list"}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
    @click="emit('close')"
  >
    <div
      class="w-[425px] max-h-[90vh] overflow-y-auto bg-default rounded-lg border border-default shadow-lg"
      @click.stop
    >
      <div class="flex items-center justify-between p-4 border-b border-default">
        <h3 class="text-base font-semibold leading-6">
          Export {{ list?.name || "list" }}
        </h3>
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-x"
          class="-my-1"
          aria-label="Close dialog"
          @click="emit('close')"
        />
      </div>

      <div class="p-4 space-y-4">
        <textarea
          :value="exportText"
          readonly
          rows="6"
          class="w-full resize-none rounded-md border border-default bg-elevated/50 p-2 text-sm outline-none"
        />

        <div class="flex gap-2">
          <UButton
            :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
            :label="copied ? 'Copied!' : 'Copy text'"
            color="primary"
            @click="copyText"
          />
          <UButton
            icon="i-lucide-download"
            label="Download .txt"
            variant="soft"
            color="neutral"
            @click="downloadTxt"
          />
        </div>

        <div v-if="qrDataUrl" class="flex flex-col items-center gap-1 pt-1">
          <img
            :src="qrDataUrl"
            alt="QR code containing the list text"
            class="rounded-lg border border-default"
          >
          <p class="text-xs text-muted">
            Scan with a phone camera to take the list with you.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
