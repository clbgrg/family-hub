<script setup lang="ts">
import type { CalendarEvent } from "~/types/calendar";
import type { TimedBlock } from "~/utils/calendarTimeline";

import { useCalendar } from "~/composables/useCalendar";
import { useStableDate } from "~/composables/useStableDate";
import {
  buildTimelineDays,
  computeHourWindow,
  eventsOnDay,
  formatHourLabel,
  layoutTimedEvents,
  minutesOfDay,
  splitDayEvents,
} from "~/utils/calendarTimeline";

const props = defineProps<{
  events: CalendarEvent[];
  startDate?: Date;
  /** Number of day columns to show (default 5: today + next 4). */
  dayCount?: number;
  /** Soft lower bound for the visible hour window; widens to fit events. */
  startHour?: number;
  /** Soft upper bound for the visible hour window; widens to fit events. */
  endHour?: number;
}>();

const emit = defineEmits<{
  (e: "eventClick", event: CalendarEvent, mouseEvent: MouseEvent): void;
}>();

const { getStableDate, parseStableDate } = useStableDate();
const {
  getEventColorClasses,
  handleEventClick: rawHandleEventClick,
  isToday,
} = useCalendar();

const HOUR_PX = 60;
const PX_PER_MIN = HOUR_PX / 60;
const MIN_BLOCK_PX = 24;

const dayCount = computed(() => props.dayCount ?? 5);
const defaultStartHour = computed(() => props.startHour ?? 7);
const defaultEndHour = computed(() => props.endHour ?? 21);

const scrollEl = ref<HTMLElement | null>(null);
const now = ref(getStableDate());
let nowTimer: ReturnType<typeof setInterval> | null = null;

const days = computed(() =>
  buildTimelineDays(props.startDate ?? getStableDate(), dayCount.value),
);

const columns = computed(() =>
  days.value.map((day) => {
    const onDay = eventsOnDay(props.events, day.date);
    const { allDay, timed } = splitDayEvents(onDay, day.date);
    return {
      day,
      allDay,
      blocks: layoutTimedEvents(timed, day.date),
    };
  }),
);

const hasAllDay = computed(() =>
  columns.value.some(column => column.allDay.length > 0),
);

const hourWindow = computed(() =>
  computeHourWindow(props.events, days.value, {
    defaultStartHour: defaultStartHour.value,
    defaultEndHour: defaultEndHour.value,
    now: getStableDate(),
  }),
);

const hours = computed(() => {
  const { startHour, endHour } = hourWindow.value;
  return Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
});

const gridHeightPx = computed(
  () => (hourWindow.value.endHour - hourWindow.value.startHour) * HOUR_PX,
);

const todayIndex = computed(() =>
  columns.value.findIndex(column => isToday(column.day.date)),
);

const nowMinute = computed(() => minutesOfDay(now.value));

const nowTopPx = computed(
  () => (nowMinute.value - hourWindow.value.startHour * 60) * PX_PER_MIN,
);

const showNowLine = computed(
  () =>
    todayIndex.value >= 0
    && nowMinute.value >= hourWindow.value.startHour * 60
    && nowMinute.value <= hourWindow.value.endHour * 60,
);

function hourTopPx(hour: number): number {
  return (hour - hourWindow.value.startHour) * HOUR_PX;
}

function blockStyle(block: TimedBlock): Record<string, string> {
  const top = (block.startMin - hourWindow.value.startHour * 60) * PX_PER_MIN;
  const height = Math.max(MIN_BLOCK_PX, (block.endMin - block.startMin) * PX_PER_MIN);
  const widthPct = 100 / block.laneCount;
  return {
    top: `${top}px`,
    height: `${height}px`,
    left: `calc(${block.lane * widthPct}% + 2px)`,
    width: `calc(${widthPct}% - 4px)`,
  };
}

function colorClass(event: CalendarEvent): string {
  const result = getEventColorClasses(event.color);
  return typeof result === "string" ? result : "";
}

function colorStyle(event: CalendarEvent): string {
  const result = getEventColorClasses(event.color);
  return typeof result === "object" && result !== null ? result.style : "";
}

function eventStart(event: CalendarEvent): Date {
  return parseStableDate(event.start);
}

function eventEnd(event: CalendarEvent): Date {
  return parseStableDate(event.end);
}

function eventLabel(event: CalendarEvent): string {
  return `Calendar event: ${event.title || "Untitled"}`;
}

function onEventClick(event: CalendarEvent, mouseEvent: MouseEvent): void {
  rawHandleEventClick(event, mouseEvent, emit);
}

function scrollToNow(): void {
  if (!showNowLine.value) {
    return;
  }
  const el = scrollEl.value;
  if (!el) {
    return;
  }
  el.scrollTop = Math.max(0, nowTopPx.value - el.clientHeight * 0.4);
}

onMounted(() => {
  now.value = new Date();
  nowTimer = setInterval(() => {
    now.value = new Date();
  }, 60_000);
  nextTick(scrollToNow);
});

onUnmounted(() => {
  if (nowTimer) {
    clearInterval(nowTimer);
  }
});

// Re-centre on the current time when the anchor day changes (e.g. "Today").
watch(() => props.startDate, () => {
  nextTick(scrollToNow);
});
</script>

<template>
  <div class="flex h-full w-full flex-col bg-default">
    <ClientOnly>
      <!-- Day headers -->
      <div class="flex shrink-0 border-b border-default">
        <div class="w-16 shrink-0 sm:w-20" />
        <div
          v-for="column in columns"
          :key="column.day.index"
          class="flex-1 border-l border-default px-1 py-3 text-center"
          :class="isToday(column.day.date) ? 'bg-primary/5' : ''"
        >
          <div
            class="text-xs font-medium uppercase tracking-wide text-muted"
          >
            <NuxtTime :datetime="column.day.date" weekday="short" />
          </div>
          <div class="mt-1 flex justify-center">
            <div
              class="inline-flex h-9 w-9 items-center justify-center rounded-full text-lg font-semibold"
              :class="
                isToday(column.day.date)
                  ? 'bg-error text-white shadow-sm'
                  : 'text-highlighted'
              "
            >
              <NuxtTime :datetime="column.day.date" day="numeric" />
            </div>
          </div>
        </div>
      </div>

      <!-- All-day rail -->
      <div
        v-if="hasAllDay"
        class="flex shrink-0 border-b border-default bg-muted/30"
      >
        <div
          class="flex w-16 shrink-0 items-center justify-end py-1 pr-2 text-[0.65rem] font-medium uppercase text-dimmed sm:w-20"
        >
          All-day
        </div>
        <div
          v-for="column in columns"
          :key="column.day.index"
          class="flex-1 space-y-1 border-l border-default p-1"
        >
          <button
            v-for="event in column.allDay"
            :key="event.id"
            type="button"
            class="block w-full cursor-pointer truncate rounded-md px-2 py-1 text-left text-xs font-medium shadow-sm"
            :class="colorClass(event)"
            :style="colorStyle(event)"
            :aria-label="eventLabel(event)"
            @click="(e) => onEventClick(event, e)"
          >
            {{ event.title }}
          </button>
        </div>
      </div>

      <!-- Timed grid -->
      <div ref="scrollEl" class="relative min-h-0 flex-1 overflow-y-auto">
        <div class="relative flex" :style="{ height: `${gridHeightPx}px` }">
          <!-- Hour gutter -->
          <div class="relative w-16 shrink-0 sm:w-20">
            <div
              v-for="hour in hours"
              :key="hour"
              class="absolute right-2 -translate-y-1/2 text-[0.7rem] font-medium text-dimmed"
              :style="{ top: `${hourTopPx(hour)}px` }"
            >
              {{ formatHourLabel(hour) }}
            </div>
          </div>

          <!-- Day columns -->
          <div
            v-for="column in columns"
            :key="column.day.index"
            class="relative flex-1 border-l border-default"
            :class="isToday(column.day.date) ? 'bg-primary/5' : ''"
          >
            <div
              v-for="hour in hours"
              :key="hour"
              class="pointer-events-none absolute inset-x-0 border-t border-default/60"
              :style="{ top: `${hourTopPx(hour)}px` }"
            />
            <button
              v-for="block in column.blocks"
              :key="block.event.id"
              type="button"
              class="absolute flex cursor-pointer flex-col overflow-hidden rounded-lg px-2 py-1 text-left shadow-sm transition hover:z-10 hover:shadow-md"
              :class="colorClass(block.event)"
              :style="[blockStyle(block), colorStyle(block.event)]"
              :aria-label="eventLabel(block.event)"
              @click.stop="(e) => onEventClick(block.event, e)"
            >
              <span class="truncate text-xs font-semibold leading-tight">
                {{ block.event.title }}
              </span>
              <span class="mt-0.5 flex items-center justify-between gap-1">
                <span class="truncate text-[0.65rem] opacity-80">
                  <NuxtTime
                    :datetime="eventStart(block.event)"
                    hour="numeric"
                    minute="2-digit"
                    :hour12="true"
                  />–<NuxtTime
                    :datetime="eventEnd(block.event)"
                    hour="numeric"
                    minute="2-digit"
                    :hour12="true"
                  />
                </span>
                <UAvatarGroup
                  v-if="(block.event.users?.length ?? 0) > 0"
                  size="xs"
                  :max="3"
                  :ui="{
                    base: 'relative ring-0 border-0 shadow-none outline-none first:me-0',
                  }"
                >
                  <UAvatar
                    v-for="user in block.event.users"
                    :key="user.id"
                    :src="user.avatar || undefined"
                    :alt="user.name"
                    :ui="{
                      root: 'relative ring-0 border-0 shadow-none outline-none',
                      image: 'object-cover ring-0 border-0 shadow-none',
                      fallback: 'ring-0 border-0 shadow-none',
                    }"
                  />
                </UAvatarGroup>
              </span>
            </button>
          </div>

          <!-- Current-time indicator (intentionally always red, like Google/Apple) -->
          <div
            v-if="showNowLine"
            class="pointer-events-none absolute right-0 left-16 z-20 sm:left-20"
            :style="{ top: `${nowTopPx}px` }"
          >
            <div class="relative h-0.5 bg-error">
              <div
                class="absolute top-1/2 -left-1 size-3 -translate-y-1/2 rounded-full bg-error shadow"
              />
            </div>
          </div>
        </div>
      </div>

      <template #fallback>
        <div class="flex h-full items-center justify-center text-muted">
          <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin" />
        </div>
      </template>
    </ClientOnly>
  </div>
</template>
