import { addDays, startOfDay } from "date-fns";

import type { CalendarEvent } from "~/types/calendar";

/** Minutes in a full day — the timeline grid is measured in minutes-from-local-midnight. */
export const MINUTES_PER_DAY = 24 * 60;

/**
 * A zero / very-short event still needs a readable slice. We inflate its end to
 * this many minutes for both layout (overlap detection) and rendering, so two
 * back-to-back instantaneous events don't render on top of each other.
 */
export const MIN_EVENT_MINUTES = 25;

export type TimelineDay = {
  /** Local midnight of the column. */
  date: Date;
  /** 0-based position in the rendered window. */
  index: number;
};

export type TimedBlock = {
  event: CalendarEvent;
  /** Minutes from this column's local midnight (clamped to the day). */
  startMin: number;
  /** Always > startMin (inflated to MIN_EVENT_MINUTES when needed). */
  endMin: number;
  /** 0-based lane within its overlap cluster. */
  lane: number;
  /** Number of lanes the cluster needs (column is split into this many). */
  laneCount: number;
};

function toDate(input: Date | string): Date {
  return input instanceof Date ? input : new Date(input);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Local minutes-of-day for a Date (0..1439), in the browser's timezone. */
export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** Build `count` consecutive day columns starting at the local day of `start`. */
export function buildTimelineDays(start: Date, count: number): TimelineDay[] {
  const base = startOfDay(start);
  return Array.from({ length: count }, (_, index) => ({
    date: addDays(base, index),
    index,
  }));
}

function dayBounds(day: Date): { startMs: number; endMs: number } {
  const startMs = startOfDay(day).getTime();
  return { startMs, endMs: startMs + MINUTES_PER_DAY * 60_000 };
}

/** Events that overlap the given local day at all (timed or all-day). */
export function eventsOnDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  const { startMs, endMs } = dayBounds(day);
  return events.filter((event) => {
    const start = toDate(event.start).getTime();
    const end = toDate(event.end).getTime();
    return start < endMs && end > startMs;
  });
}

/**
 * True when the event should live in the all-day rail for `day`: either it is
 * flagged all-day, or it covers the entire visible day (e.g. a multi-day event
 * passing through this column).
 */
export function isAllDayOnDay(event: CalendarEvent, day: Date): boolean {
  if (event.allDay) {
    return true;
  }
  const { startMs, endMs } = dayBounds(day);
  const start = toDate(event.start).getTime();
  const end = toDate(event.end).getTime();
  return start <= startMs && end >= endMs;
}

/** Partition a day's events into the all-day rail and the timed grid. */
export function splitDayEvents(
  events: CalendarEvent[],
  day: Date,
): { allDay: CalendarEvent[]; timed: CalendarEvent[] } {
  const allDay: CalendarEvent[] = [];
  const timed: CalendarEvent[] = [];
  for (const event of events) {
    if (isAllDayOnDay(event, day)) {
      allDay.push(event);
    }
    else {
      timed.push(event);
    }
  }
  return { allDay, timed };
}

type RawInterval = { event: CalendarEvent; startMin: number; endMin: number };

/**
 * Greedy interval-graph lane packing. Events are grouped into clusters of
 * transitively-overlapping intervals; within a cluster each event takes the
 * first free lane, and every event in the cluster shares the cluster's total
 * lane count so columns line up. Input must be sorted by startMin then endMin.
 */
function packLanes(items: RawInterval[]): TimedBlock[] {
  const result: TimedBlock[] = [];
  let group: Array<RawInterval & { lane: number }> = [];
  let laneEnds: number[] = [];
  let groupMaxEnd = Number.NEGATIVE_INFINITY;

  const flush = () => {
    const laneCount = laneEnds.length || 1;
    for (const item of group) {
      result.push({
        event: item.event,
        startMin: item.startMin,
        endMin: item.endMin,
        lane: item.lane,
        laneCount,
      });
    }
    group = [];
    laneEnds = [];
    groupMaxEnd = Number.NEGATIVE_INFINITY;
  };

  for (const item of items) {
    // No overlap with anything in the current cluster → close it out.
    if (group.length > 0 && item.startMin >= groupMaxEnd) {
      flush();
    }

    let lane = laneEnds.findIndex(end => end <= item.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.endMin);
    }
    else {
      laneEnds[lane] = item.endMin;
    }

    group.push({ ...item, lane });
    groupMaxEnd = Math.max(groupMaxEnd, item.endMin);
  }

  if (group.length > 0) {
    flush();
  }

  return result;
}

/**
 * Position a day's timed events as lane-packed blocks measured in minutes from
 * local midnight. Multi-day events are clamped to this column's bounds.
 */
export function layoutTimedEvents(events: CalendarEvent[], day: Date): TimedBlock[] {
  const { startMs, endMs } = dayBounds(day);

  const intervals: RawInterval[] = events.map((event) => {
    const startClampedMs = Math.max(toDate(event.start).getTime(), startMs);
    const endClampedMs = Math.min(toDate(event.end).getTime(), endMs);
    const startMin = clamp(Math.round((startClampedMs - startMs) / 60_000), 0, MINUTES_PER_DAY);
    let endMin = clamp(Math.round((endClampedMs - startMs) / 60_000), 0, MINUTES_PER_DAY);
    if (endMin <= startMin) {
      endMin = Math.min(startMin + MIN_EVENT_MINUTES, MINUTES_PER_DAY);
    }
    return { event, startMin, endMin };
  });

  intervals.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  return packLanes(intervals);
}

/**
 * Choose the visible hour window. Starts from the defaults (e.g. 7–21) and
 * widens to include every timed event in the window plus the current time when
 * today is on screen, so nothing is ever clipped. Result is whole hours.
 */
export function computeHourWindow(
  events: CalendarEvent[],
  days: TimelineDay[],
  opts: { defaultStartHour: number; defaultEndHour: number; now?: Date | null },
): { startHour: number; endHour: number } {
  let minMinute = opts.defaultStartHour * 60;
  let maxMinute = opts.defaultEndHour * 60;

  for (const day of days) {
    const { timed } = splitDayEvents(eventsOnDay(events, day.date), day.date);
    for (const block of layoutTimedEvents(timed, day.date)) {
      minMinute = Math.min(minMinute, block.startMin);
      maxMinute = Math.max(maxMinute, block.endMin);
    }
  }

  if (opts.now) {
    const todayVisible = days.some(day => isSameLocalDay(day.date, opts.now as Date));
    if (todayVisible) {
      const nowMinute = minutesOfDay(opts.now);
      minMinute = Math.min(minMinute, nowMinute);
      maxMinute = Math.max(maxMinute, nowMinute + 30);
    }
  }

  const startHour = clamp(Math.floor(minMinute / 60), 0, 23);
  const endHour = clamp(Math.ceil(maxMinute / 60), startHour + 1, 24);
  return { startHour, endHour };
}

/** Same local calendar date (browser timezone), ignoring time-of-day. */
export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
  );
}

/** Format a whole hour (0–24) as a compact label like "8 AM" / "12 PM". */
export function formatHourLabel(hour: number): string {
  const normalized = ((hour % 24) + 24) % 24;
  const period = normalized < 12 ? "AM" : "PM";
  const display = normalized % 12 === 0 ? 12 : normalized % 12;
  return `${display} ${period}`;
}
