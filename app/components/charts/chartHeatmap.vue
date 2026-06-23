<script setup lang="ts">
// Theme-aware participation heatmap (rows × day-columns), e.g. each member's
// points per day. Cell intensity scales with the value; zero cells show the
// faint track. CSS-grid (lighter than SVG for a dense grid); colors come from a
// row's own color or the theme's --chart-1.
const props = defineProps<{
  rows: { key: string; label: string; color?: string | null }[];
  cols: string[];
  matrix: number[][];
}>();

const max = computed(() => Math.max(1, ...props.matrix.flat()));

function cellColor(value: number, rowColor?: string | null) {
  if (value <= 0)
    return "var(--ui-bg-elevated)";
  const base = rowColor || "var(--chart-1)";
  const pct = Math.round(18 + 82 * (value / max.value));
  return `color-mix(in srgb, ${base} ${pct}%, transparent)`;
}

// A handful of evenly-spaced column ticks (first, ~mid, last) to avoid clutter.
const ticks = computed(() => {
  const n = props.cols.length;
  if (n <= 1)
    return [0];
  return [0, Math.floor(n / 2), n - 1];
});
</script>

<template>
  <div v-if="rows.length && cols.length" class="overflow-x-auto">
    <div
      v-for="(row, r) in rows"
      :key="row.key"
      class="mb-1 flex items-center gap-2"
    >
      <span class="w-16 shrink-0 truncate text-xs text-muted">{{ row.label }}</span>
      <div class="flex flex-1 gap-0.5">
        <div
          v-for="(_, c) in cols"
          :key="c"
          class="h-4 flex-1 rounded-[2px]"
          :style="{ backgroundColor: cellColor(matrix[r]?.[c] ?? 0, row.color) }"
          :title="`${row.label} · ${cols[c]}: ${matrix[r]?.[c] ?? 0}`"
        />
      </div>
    </div>
    <div class="mt-1 flex items-center gap-2">
      <span class="w-16 shrink-0" />
      <div class="relative flex-1 text-[10px] text-dimmed">
        <span
          v-for="t in ticks"
          :key="t"
          class="absolute -translate-x-1/2"
          :style="{ left: `${(t / Math.max(1, cols.length - 1)) * 100}%` }"
        >{{ cols[t] }}</span>
      </div>
    </div>
  </div>
  <p v-else class="text-sm text-muted">
    No data yet.
  </p>
</template>
