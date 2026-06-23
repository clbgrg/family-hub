<script setup lang="ts">
// Hand-rolled SVG donut/pie chart (no charting dep, matches the repo's
// pointsLineChart approach). Theme-aware: a slice's own color wins, else the
// active theme's --chart-N palette. Segments are drawn as dasharray strokes on
// a single circle — no arc-path math.
const props = withDefaults(defineProps<{
  items: { label: string; value: number; color?: string | null }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
}>(), { size: 180, thickness: 26, centerLabel: "" });

const radius = computed(() => (props.size - props.thickness) / 2);
const circumference = computed(() => 2 * Math.PI * radius.value);
const total = computed(() => props.items.reduce((s, i) => s + Math.max(0, i.value), 0));

function colorFor(item: { color?: string | null }, i: number) {
  return item.color || `var(--chart-${(i % 8) + 1})`;
}

// Each visible slice → { dash, offset, color } against the circle circumference.
const segments = computed(() => {
  const c = circumference.value;
  let acc = 0;
  return props.items
    .map((item, i) => ({ item, i }))
    .filter(({ item }) => item.value > 0)
    .map(({ item, i }) => {
      const frac = total.value > 0 ? item.value / total.value : 0;
      const seg = { dash: frac * c, gap: c - frac * c, offset: -acc * c, color: colorFor(item, i), label: item.label, value: item.value, pct: Math.round(frac * 100) };
      acc += frac;
      return seg;
    });
});
</script>

<template>
  <div class="flex flex-col items-center gap-3 sm:flex-row sm:items-center">
    <svg
      :viewBox="`0 0 ${size} ${size}`"
      :width="size"
      :height="size"
      class="shrink-0"
      role="img"
      :aria-label="`Donut chart, total ${total}`"
    >
      <g :transform="`rotate(-90 ${size / 2} ${size / 2})`">
        <circle
          :cx="size / 2"
          :cy="size / 2"
          :r="radius"
          fill="none"
          stroke="var(--ui-bg-elevated)"
          :stroke-width="thickness"
        />
        <circle
          v-for="(s, idx) in segments"
          :key="idx"
          :cx="size / 2"
          :cy="size / 2"
          :r="radius"
          fill="none"
          :stroke="s.color"
          :stroke-width="thickness"
          :stroke-dasharray="`${s.dash} ${s.gap}`"
          :stroke-dashoffset="s.offset"
        />
      </g>
      <text
        :x="size / 2"
        :y="size / 2 - 4"
        text-anchor="middle"
        class="fill-[var(--ui-text-highlighted)] text-2xl font-bold"
      >{{ total }}</text>
      <text
        v-if="centerLabel"
        :x="size / 2"
        :y="size / 2 + 16"
        text-anchor="middle"
        class="fill-[var(--ui-text-muted)] text-xs"
      >{{ centerLabel }}</text>
    </svg>

    <ul v-if="segments.length" class="flex flex-1 flex-col gap-1.5 text-sm">
      <li
        v-for="(s, idx) in segments"
        :key="idx"
        class="flex items-center gap-2"
      >
        <span class="size-3 shrink-0 rounded-sm" :style="{ backgroundColor: s.color }" />
        <span class="min-w-0 flex-1 truncate">{{ s.label }}</span>
        <span class="shrink-0 text-muted">{{ s.value }} · {{ s.pct }}%</span>
      </li>
    </ul>
    <p v-else class="text-sm text-muted">
      No data yet.
    </p>
  </div>
</template>
