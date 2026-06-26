<script setup lang="ts">
import {
  applyCase,
  backspaceElement,
  insertIntoElement,
  liftIntoView,
  pressEnter,
} from "~/utils/keyboardInput";

const { visible, target, layout, hide } = useVirtualKeyboard();

const shift = ref(false);
const caps = ref(false);
const kbEl = ref<HTMLElement | null>(null);

const QWERTY_ROWS = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
];
const NUMERIC_ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "-"],
];

// What a key shows given the current shift/caps state (letters only change).
function keyLabel(k: string): string {
  return applyCase(k, { shift: shift.value, caps: caps.value });
}

function type(k: string) {
  const t = target.value;
  if (!t)
    return;
  insertIntoElement(t, applyCase(k, { shift: shift.value, caps: caps.value }));
  if (shift.value && /[a-z]/i.test(k))
    shift.value = false; // Shift is one-shot.
}
function space() {
  if (target.value)
    insertIntoElement(target.value, " ");
}
function backspace() {
  if (target.value)
    backspaceElement(target.value);
}
function enter() {
  const t = target.value;
  if (!t)
    return;
  if (pressEnter(t).close)
    hide();
}
function toggleShift() {
  shift.value = !shift.value;
}
function toggleCaps() {
  caps.value = !caps.value;
  shift.value = false;
}

// Keep the focused field visible above the keyboard; undo on hide / change.
let liftCleanup: (() => void) | null = null;
watch(
  [visible, target],
  async ([vis, tgt]) => {
    liftCleanup?.();
    liftCleanup = null;
    if (vis && tgt) {
      await nextTick();
      const h = kbEl.value?.getBoundingClientRect().height ?? 300;
      liftCleanup = liftIntoView(tgt, h);
    }
  },
  { flush: "post" },
);
// Reset transient modifier state each time the keyboard opens.
watch(visible, (v) => {
  if (v) {
    shift.value = false;
    caps.value = false;
  }
});
onBeforeUnmount(() => liftCleanup?.());
</script>

<template>
  <div v-if="visible">
    <div
      ref="kbEl"
      data-no-keyboard
      class="fixed inset-x-0 bottom-0 z-[250] select-none border-t border-default bg-default/95 p-2 shadow-2xl backdrop-blur sm:mx-auto sm:max-w-3xl sm:rounded-t-2xl"
    >
      <div class="mx-auto flex max-w-3xl flex-col gap-1.5">
        <!-- Numeric layout -->
        <template v-if="layout === 'numeric'">
          <div
            v-for="(row, i) in NUMERIC_ROWS"
            :key="`n${i}`"
            class="flex justify-center gap-1.5"
          >
            <button
              v-for="k in row"
              :key="k"
              type="button"
              class="vk-key w-24 max-w-[28%]"
              @pointerdown.prevent
              @click="type(k)"
            >
              {{ k }}
            </button>
          </div>
          <div class="flex justify-center gap-1.5">
            <button
              type="button"
              class="vk-key vk-key-wide"
              aria-label="Backspace"
              @pointerdown.prevent
              @click="backspace"
            >
              <UIcon name="i-lucide-delete" class="size-5" />
            </button>
            <button
              type="button"
              class="vk-key vk-key-wide vk-key-primary"
              aria-label="Enter"
              @pointerdown.prevent
              @click="enter"
            >
              <UIcon name="i-lucide-corner-down-left" class="size-5" />
            </button>
            <button
              type="button"
              class="vk-key vk-key-wide"
              aria-label="Close keyboard"
              @pointerdown.prevent
              @click="hide"
            >
              <UIcon name="i-lucide-chevron-down" class="size-5" />
            </button>
          </div>
        </template>

        <!-- QWERTY layout -->
        <template v-else>
          <div
            v-for="(row, i) in QWERTY_ROWS"
            :key="`q${i}`"
            class="flex gap-1.5"
          >
            <button
              v-if="i === 3"
              type="button"
              class="vk-key shrink-0 basis-16"
              :class="shift ? 'vk-key-active' : ''"
              aria-label="Shift"
              @pointerdown.prevent
              @click="toggleShift"
            >
              <UIcon name="i-lucide-arrow-big-up" class="size-5" />
            </button>
            <button
              v-for="k in row"
              :key="k"
              type="button"
              class="vk-key flex-1"
              @pointerdown.prevent
              @click="type(k)"
            >
              {{ keyLabel(k) }}
            </button>
            <button
              v-if="i === 3"
              type="button"
              class="vk-key shrink-0 basis-16"
              aria-label="Backspace"
              @pointerdown.prevent
              @click="backspace"
            >
              <UIcon name="i-lucide-delete" class="size-5" />
            </button>
          </div>
          <div class="flex gap-1.5">
            <button
              type="button"
              class="vk-key shrink-0 basis-16"
              :class="caps ? 'vk-key-active' : ''"
              aria-label="Caps lock"
              @pointerdown.prevent
              @click="toggleCaps"
            >
              <UIcon name="i-lucide-arrow-big-up-dash" class="size-5" />
            </button>
            <button
              v-for="p in ['.', ',', '@']"
              :key="p"
              type="button"
              class="vk-key shrink-0 basis-12"
              @pointerdown.prevent
              @click="type(p)"
            >
              {{ p }}
            </button>
            <button
              type="button"
              class="vk-key flex-1"
              aria-label="Space"
              @pointerdown.prevent
              @click="space"
            >
              &nbsp;
            </button>
            <button
              v-for="p in ['-', '\'']"
              :key="p"
              type="button"
              class="vk-key shrink-0 basis-12"
              @pointerdown.prevent
              @click="type(p)"
            >
              {{ p }}
            </button>
            <button
              type="button"
              class="vk-key vk-key-primary shrink-0 basis-20"
              aria-label="Enter"
              @pointerdown.prevent
              @click="enter"
            >
              <UIcon name="i-lucide-corner-down-left" class="size-5" />
            </button>
            <button
              type="button"
              class="vk-key shrink-0 basis-16"
              aria-label="Close keyboard"
              @pointerdown.prevent
              @click="hide"
            >
              <UIcon name="i-lucide-chevron-down" class="size-5" />
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vk-key {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 2.75rem;
  padding: 0.5rem 0.25rem;
  border-radius: 0.5rem;
  font-size: 1.05rem;
  font-weight: 500;
  background: var(--ui-bg-elevated);
  color: var(--ui-text-highlighted);
  border: 1px solid var(--ui-border);
  touch-action: manipulation;
}
.vk-key:active {
  background: var(--ui-bg-accented);
}
.vk-key-wide {
  flex: 1 1 0;
  max-width: 8rem;
}
.vk-key-primary {
  background: var(--ui-primary);
  color: white;
  border-color: var(--ui-primary);
}
.vk-key-active {
  background: var(--ui-primary);
  color: white;
  border-color: var(--ui-primary);
}
</style>
