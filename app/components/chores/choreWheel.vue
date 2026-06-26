<script setup lang="ts">
const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: "close"): void }>();

const { chores, add, edit, remove, clear, reset } = useWheelChores();
const { user } = useUserSession();
const { gate } = useAdminGate();
const toast = useToast();
const isAdmin = computed(() => user.value?.role === "ADMIN");

// Distinct, cheerful slice colors (cycled).
const PALETTE = ["#ef4444", "#f59e0b", "#22c55e", "#0ea5e9", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

const rotation = ref(0);
const spinning = ref(false);
const result = ref<number | null>(null); // index of the landed chore
const pendingIdx = ref(0);
const soundOn = ref(false);
const managing = ref(false);

// Management inputs.
const newChore = ref("");
const editIndex = ref<number | null>(null);
const editText = ref("");

const n = computed(() => chores.value.length);
const seg = computed(() => (n.value ? 360 / n.value : 360));
const resultTitle = computed(() => (result.value != null ? chores.value[result.value] ?? null : null));

// Point on the wheel (viewBox 0..200, center 100,100) at `r` from center and
// `angleDeg` measured clockwise from the top (12 o'clock = 0°).
function polar(r: number, angleDeg: number): [number, number] {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [100 + r * Math.cos(a), 100 + r * Math.sin(a)];
}

const slices = computed(() =>
  chores.value.map((title, i) => {
    const a0 = i * seg.value;
    const a1 = (i + 1) * seg.value;
    const [x0, y0] = polar(95, a0);
    const [x1, y1] = polar(95, a1);
    const large = seg.value > 180 ? 1 : 0;
    const d = n.value === 1
      ? "M 100 5 A 95 95 0 1 1 99.99 5 Z"
      : `M 100 100 L ${x0.toFixed(2)} ${y0.toFixed(2)} A 95 95 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
    const mid = a0 + seg.value / 2;
    const [lx, ly] = polar(60, mid);
    // Run the label along its slice's radius. `mid` is clockwise from the top,
    // so the outward radial direction in SVG rotation terms is `mid - 90`.
    // Flip labels on the left half so none read upside-down.
    let rot = (((mid - 90) % 360) + 360) % 360;
    if (rot > 90 && rot < 270) {
      rot += 180;
    }
    return { i, title, color: PALETTE[i % PALETTE.length]!, d, lx, ly, rot };
  }),
);

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function playDing() {
  if (!soundOn.value || typeof window === "undefined" || typeof AudioContext === "undefined")
    return;
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  }
  catch {
    // Best-effort flair; never let audio break the wheel.
  }
}

function finish() {
  spinning.value = false;
  result.value = pendingIdx.value;
  playDing();
  if (!reducedMotion()) {
    import("canvas-confetti")
      .then(m => m.default({ particleCount: 110, spread: 95, origin: { y: 0.4 } }))
      .catch(() => {});
  }
}

function spin() {
  if (spinning.value || n.value === 0)
    return;
  result.value = null;
  pendingIdx.value = Math.floor(Math.random() * n.value);
  if (reducedMotion()) {
    finish();
    return;
  }
  spinning.value = true;
  // Land slice `idx` under the top pointer: rotate so its centre sits at 0°,
  // plus several full turns and a little within-slice jitter for natural feel.
  const base = Math.ceil((rotation.value + 1) / 360) * 360;
  const land = 360 - (pendingIdx.value * seg.value + seg.value / 2);
  const jitter = (Math.random() - 0.5) * seg.value * 0.7;
  rotation.value = base + 360 * 5 + land - jitter;
}

function onTransitionEnd() {
  if (spinning.value)
    finish();
}

function acceptChore() {
  toast.add({ title: "Chore accepted", description: resultTitle.value ?? "", icon: "i-lucide-check", color: "success" });
  emit("close");
}

// Management actions (admin-gated; the PUT endpoint also enforces elevation).
async function addChore() {
  const t = newChore.value;
  await gate(() => add(t));
  newChore.value = "";
}
function startEdit(i: number) {
  editIndex.value = i;
  editText.value = chores.value[i] ?? "";
}
async function saveEdit() {
  if (editIndex.value == null)
    return;
  const i = editIndex.value;
  await gate(() => edit(i, editText.value));
  editIndex.value = null;
}
function deleteChore(i: number) {
  return gate(() => remove(i));
}
function clearWheel() {
  return gate(() => clear());
}
function resetWheel() {
  return gate(() => reset());
}

watch(() => chores.value.length, () => {
  // Drop a stale result if the list shrank underneath us.
  if (result.value != null && result.value >= chores.value.length)
    result.value = null;
});

// Reset transient UI each time the wheel opens.
watch(() => props.open, (o) => {
  if (o) {
    result.value = null;
    managing.value = false;
    editIndex.value = null;
  }
});
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
    @click="emit('close')"
  >
    <div class="w-[440px] max-w-full max-h-[92vh] overflow-y-auto rounded-lg border border-default bg-default p-5 shadow-lg" @click.stop>
      <div class="mb-3 flex items-center justify-between gap-2">
        <h3 class="flex items-center gap-2 text-base font-semibold text-highlighted">
          <UIcon name="i-lucide-disc-3" class="size-5 text-primary" />
          Chore Wheel
        </h3>
        <div class="flex items-center gap-1">
          <UButton
            :icon="soundOn ? 'i-lucide-volume-2' : 'i-lucide-volume-x'"
            color="neutral"
            variant="ghost"
            size="sm"
            :aria-label="soundOn ? 'Mute' : 'Unmute'"
            @click="soundOn = !soundOn"
          />
          <UButton
            v-if="isAdmin"
            :icon="managing ? 'i-lucide-disc-3' : 'i-lucide-pencil'"
            color="neutral"
            variant="ghost"
            size="sm"
            :aria-label="managing ? 'Back to wheel' : 'Manage chores'"
            @click="managing = !managing"
          />
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            aria-label="Close"
            @click="emit('close')"
          />
        </div>
      </div>

      <!-- Manage panel (admin) -->
      <div v-if="managing" class="space-y-3">
        <div class="flex gap-2">
          <UInput
            v-model="newChore"
            placeholder="Add a chore to the wheel…"
            class="flex-1"
            :ui="{ base: 'w-full' }"
            @keyup.enter="addChore"
          />
          <UButton
            icon="i-lucide-plus"
            :disabled="!newChore.trim()"
            @click="addChore"
          />
        </div>
        <ul v-if="chores.length" class="flex flex-col gap-1">
          <li
            v-for="(c, i) in chores"
            :key="i"
            class="flex items-center gap-2 rounded-md border border-default p-2"
          >
            <template v-if="editIndex === i">
              <UInput
                v-model="editText"
                class="flex-1"
                :ui="{ base: 'w-full' }"
                @keyup.enter="saveEdit"
              />
              <UButton
                icon="i-lucide-check"
                size="xs"
                color="primary"
                @click="saveEdit"
              />
              <UButton
                icon="i-lucide-x"
                size="xs"
                variant="ghost"
                color="neutral"
                @click="editIndex = null"
              />
            </template>
            <template v-else>
              <span class="min-w-0 flex-1 truncate text-sm">{{ c }}</span>
              <UButton
                icon="i-lucide-pencil"
                size="xs"
                variant="ghost"
                color="neutral"
                aria-label="Edit"
                @click="startEdit(i)"
              />
              <UButton
                icon="i-lucide-trash"
                size="xs"
                variant="ghost"
                color="error"
                aria-label="Delete"
                @click="deleteChore(i)"
              />
            </template>
          </li>
        </ul>
        <p v-else class="text-center text-sm text-muted">
          The wheel is empty. Add some chores or reset to defaults.
        </p>
        <div class="flex justify-between">
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-lucide-eraser"
            :disabled="!chores.length"
            @click="clearWheel"
          >
            Clear wheel
          </UButton>
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-lucide-rotate-ccw"
            @click="resetWheel"
          >
            Reset to defaults
          </UButton>
        </div>
      </div>

      <!-- Wheel -->
      <template v-else>
        <div v-if="n === 0" class="py-8 text-center text-sm text-muted">
          The wheel is empty.
          <template v-if="isAdmin">
            Use the pencil to add chores or reset to defaults.
          </template>
          <template v-else>
            Ask a parent to add some chores.
          </template>
        </div>

        <template v-else>
          <div class="relative mx-auto aspect-square w-72 max-w-full">
            <!-- Pointer (fixed at the top, pointing into the wheel). -->
            <div class="absolute left-1/2 top-0 z-10 -translate-x-1/2">
              <div class="size-0 border-x-8 border-t-[16px] border-x-transparent border-t-primary" />
            </div>
            <svg
              viewBox="0 0 200 200"
              class="w-full drop-shadow"
              :style="{
                transform: `rotate(${rotation}deg)`,
                transformOrigin: 'center',
                transition: spinning ? 'transform 4.2s cubic-bezier(0.17, 0.67, 0.21, 1)' : 'none',
              }"
              @transitionend="onTransitionEnd"
            >
              <path
                v-for="s in slices"
                :key="s.i"
                :d="s.d"
                :fill="s.color"
                :stroke="result === s.i ? '#fde047' : 'white'"
                :stroke-width="result === s.i ? 3 : 1"
                :style="result === s.i ? 'filter: brightness(1.15);' : ''"
              />
              <text
                v-for="s in slices"
                :key="`t${s.i}`"
                :x="s.lx"
                :y="s.ly"
                :transform="`rotate(${s.rot} ${s.lx} ${s.ly})`"
                text-anchor="middle"
                dominant-baseline="middle"
                class="fill-white text-[9px] font-bold"
                stroke="rgba(0,0,0,0.55)"
                stroke-width="0.6"
                style="paint-order: stroke"
              >{{ s.title.length > 14 ? `${s.title.slice(0, 13)}…` : s.title }}</text>
              <circle
                cx="100"
                cy="100"
                r="10"
                fill="white"
                stroke="#00000022"
              />
            </svg>
          </div>

          <!-- Result modal section -->
          <div v-if="resultTitle" class="mt-4 text-center">
            <p class="flex items-center justify-center gap-1.5 text-sm text-muted">
              <UIcon name="i-lucide-party-popper" class="size-4 text-primary" />
              Your Chore Is:
            </p>
            <p class="mt-1 text-2xl font-bold text-highlighted">
              {{ resultTitle }}
            </p>
            <div class="mt-4 flex justify-center gap-2">
              <UButton
                color="primary"
                icon="i-lucide-check"
                @click="acceptChore"
              >
                Accept Chore
              </UButton>
              <UButton
                color="neutral"
                variant="soft"
                icon="i-lucide-rotate-cw"
                :disabled="spinning"
                @click="spin"
              >
                Spin Again
              </UButton>
            </div>
          </div>

          <div v-else class="mt-4 flex flex-col items-center gap-2">
            <p class="text-center text-sm text-muted">
              Give it a spin to pick a random chore!
            </p>
            <UButton
              size="lg"
              color="primary"
              icon="i-lucide-rotate-cw"
              :loading="spinning"
              :disabled="spinning"
              @click="spin"
            >
              Spin the wheel
            </UButton>
          </div>
        </template>
      </template>
    </div>
  </div>
</template>
