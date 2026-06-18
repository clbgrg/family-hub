<script setup lang="ts">
const props = defineProps<{
  // "" = everyone (admins); a member id scopes to one. Drives the fetch.
  userId: string;
  // Client-local today (YYYY-MM-DD) — the window ends here.
  date: string;
  pointsLabel?: string;
}>();

type Series = { userId: string; name: string; color: string | null; points: number[] };
type SeriesResponse = { since: string; days: number; dates: string[]; series: Series[] };

const requestFetch = useRequestFetch();
const days = ref(30);
const combined = ref(false);

const { data } = useAsyncData(
  "points-series",
  () => requestFetch<SeriesResponse>("/api/chores/points-series", {
    query: { date: props.date, days: days.value, userId: props.userId || undefined },
  }),
  {
    default: (): SeriesResponse => ({ since: "", days: 30, dates: [], series: [] }),
    server: false,
    watch: [() => props.userId, days],
  },
);

const dates = computed(() => data.value.dates);

// Fallback line colors for members without a custom color.
const PALETTE = ["#0ea5e9", "#22c55e", "#f59e0b", "#ec4899", "#8b5cf6", "#ef4444", "#14b8a6", "#eab308"];
function colorFor(s: Series, i: number) {
  return s.color || PALETTE[i % PALETTE.length]!;
}

// Cumulative running total — a smoother "over time" line than spiky per-day.
function cumulative(points: number[]): number[] {
  let run = 0;
  return points.map((p) => {
    run += p;
    return run;
  });
}

// The lines actually drawn: each member's cumulative, or one combined total.
const lines = computed(() => {
  const series = data.value.series;
  if (combined.value && series.length > 1) {
    const totalDaily = dates.value.map((_, i) => series.reduce((sum, s) => sum + (s.points[i] ?? 0), 0));
    return [{ key: "__total__", name: "Family total", color: "#0ea5e9", values: cumulative(totalDaily) }];
  }
  return series.map((s, i) => ({ key: s.userId, name: s.name, color: colorFor(s, i), values: cumulative(s.points) }));
});

const hasData = computed(() => lines.value.some(l => (l.values.at(-1) ?? 0) > 0));

// SVG geometry (viewBox units; scales to container width).
const W = 760;
const H = 260;
const PAD = { top: 12, right: 12, bottom: 26, left: 40 };
const innerW = W - PAD.left - PAD.right;
const innerH = H - PAD.top - PAD.bottom;

const yMax = computed(() => {
  const m = Math.max(1, ...lines.value.flatMap(l => l.values));
  const pow = 10 ** Math.floor(Math.log10(m)); // round up to a "nice" axis top
  return Math.ceil(m / pow) * pow;
});

function xAt(i: number): number {
  const n = dates.value.length;
  return n <= 1 ? PAD.left : PAD.left + (i / (n - 1)) * innerW;
}
function yAt(v: number): number {
  return PAD.top + innerH - (v / yMax.value) * innerH;
}
function pathFor(values: number[]): string {
  return values.map((v, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(" ");
}

const yTicks = computed(() => [0, 0.25, 0.5, 0.75, 1].map(f => ({ v: Math.round(yMax.value * f), y: yAt(yMax.value * f) })));

function fmtDate(d: string): string {
  const dt = new Date(`${d}T00:00:00`);
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}
const xTicks = computed(() => {
  const n = dates.value.length;
  if (!n)
    return [];
  const count = Math.min(6, n);
  const out: { label: string; x: number }[] = [];
  for (let k = 0; k < count; k++) {
    const i = Math.round((k / (count - 1 || 1)) * (n - 1));
    out.push({ label: fmtDate(dates.value[i]!), x: xAt(i) });
  }
  return out;
});

// Hover: nearest date index under the cursor → guide line + tooltip.
const hoverIdx = ref<number | null>(null);
const svgRef = ref<SVGSVGElement | null>(null);
function onMove(e: MouseEvent) {
  const n = dates.value.length;
  if (!n || !svgRef.value)
    return;
  const rect = svgRef.value.getBoundingClientRect();
  const px = ((e.clientX - rect.left) / rect.width) * W;
  const frac = (px - PAD.left) / innerW;
  hoverIdx.value = Math.max(0, Math.min(n - 1, Math.round(frac * (n - 1))));
}
function onLeave() {
  hoverIdx.value = null;
}
</script>

<template>
  <div class="rounded-lg border border-default p-4">
    <div class="mb-2 flex flex-wrap items-center gap-2">
      <h2 class="font-semibold text-highlighted">
        Chore points over time
      </h2>
      <div class="ml-auto flex items-center gap-2">
        <UButton
          v-if="data.series.length > 1"
          size="xs"
          :variant="combined ? 'solid' : 'soft'"
          color="primary"
          @click="combined = !combined"
        >
          {{ combined ? "Per member" : "Family total" }}
        </UButton>
        <div class="flex items-center gap-1">
          <UButton
            size="xs"
            :variant="days === 30 ? 'solid' : 'soft'"
            color="neutral"
            @click="days = 30"
          >
            30d
          </UButton>
          <UButton
            size="xs"
            :variant="days === 90 ? 'solid' : 'soft'"
            color="neutral"
            @click="days = 90"
          >
            90d
          </UButton>
        </div>
      </div>
    </div>

    <div v-if="hasData" class="relative">
      <svg
        ref="svgRef"
        :viewBox="`0 0 ${W} ${H}`"
        class="w-full"
        role="img"
        aria-label="Chore points over time"
        @mousemove="onMove"
        @mouseleave="onLeave"
      >
        <g>
          <line
            v-for="t in yTicks"
            :key="`g${t.v}`"
            :x1="PAD.left"
            :x2="W - PAD.right"
            :y1="t.y"
            :y2="t.y"
            :style="{ stroke: 'var(--ui-border-muted)' }"
            stroke-width="1"
          />
          <text
            v-for="t in yTicks"
            :key="`yl${t.v}`"
            :x="PAD.left - 6"
            :y="t.y + 3"
            text-anchor="end"
            class="text-[10px]"
            :style="{ fill: 'var(--ui-text-dimmed)' }"
          >{{ t.v }}</text>
        </g>
        <text
          v-for="t in xTicks"
          :key="`xl${t.x}`"
          :x="t.x"
          :y="H - 8"
          text-anchor="middle"
          class="text-[10px]"
          :style="{ fill: 'var(--ui-text-dimmed)' }"
        >{{ t.label }}</text>
        <line
          v-if="hoverIdx !== null"
          :x1="xAt(hoverIdx)"
          :x2="xAt(hoverIdx)"
          :y1="PAD.top"
          :y2="PAD.top + innerH"
          :style="{ stroke: 'var(--ui-border-accented)' }"
          stroke-width="1"
          stroke-dasharray="3 3"
        />
        <g v-for="l in lines" :key="l.key">
          <path
            :d="pathFor(l.values)"
            fill="none"
            :stroke="l.color"
            stroke-width="2"
            stroke-linejoin="round"
            stroke-linecap="round"
          />
          <circle
            v-if="hoverIdx !== null"
            :cx="xAt(hoverIdx)"
            :cy="yAt(l.values[hoverIdx]!)"
            r="3.5"
            :fill="l.color"
          />
        </g>
      </svg>

      <div
        v-if="hoverIdx !== null"
        class="pointer-events-none absolute left-2 top-2 rounded-md border border-default bg-elevated px-2 py-1 text-xs shadow-sm"
      >
        <p class="font-medium text-highlighted">
          {{ fmtDate(dates[hoverIdx]!) }}
        </p>
        <p
          v-for="l in lines"
          :key="`tt${l.key}`"
          class="flex items-center gap-1"
        >
          <span class="size-2 rounded-full" :style="{ backgroundColor: l.color }" />
          <span class="text-muted">{{ l.name }}:</span>
          <span class="font-medium">{{ l.values[hoverIdx] }} {{ pointsLabel ?? "pts" }}</span>
        </p>
      </div>

      <div v-if="lines.length > 1" class="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        <span
          v-for="l in lines"
          :key="`lg${l.key}`"
          class="flex items-center gap-1 text-xs text-muted"
        >
          <span class="size-2 rounded-full" :style="{ backgroundColor: l.color }" />{{ l.name }}
        </span>
      </div>
    </div>
    <p v-else class="py-8 text-center text-sm text-muted">
      No chore points in this window yet.
    </p>
  </div>
</template>
