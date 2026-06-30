import { describe, expect, it } from "vitest";

import type { CalendarEvent } from "~/types/calendar";

import {
  buildTimelineDays,
  computeHourWindow,
  eventsOnDay,
  formatHourLabel,
  isAllDayOnDay,
  layoutTimedEvents,
  MIN_EVENT_MINUTES,
  minutesOfDay,
  splitDayEvents,
} from "../../../../app/utils/calendarTimeline";

// Vitest pins TZ=UTC (see vitest.config.ts), so all wall-clock math below is UTC.
const DAY = new Date("2026-06-30T00:00:00Z");

function event(overrides: Partial<CalendarEvent> & { id: string }): CalendarEvent {
  return {
    title: overrides.id,
    start: new Date("2026-06-30T09:00:00Z"),
    end: new Date("2026-06-30T10:00:00Z"),
    allDay: false,
    users: [],
    ...overrides,
  } as CalendarEvent;
}

describe("buildTimelineDays", () => {
  it("returns N consecutive local-midnight days from the start day", () => {
    const days = buildTimelineDays(new Date("2026-06-30T15:30:00Z"), 5);
    expect(days).toHaveLength(5);
    expect(days[0]!.date.toISOString()).toBe("2026-06-30T00:00:00.000Z");
    expect(days[0]!.index).toBe(0);
    expect(days[4]!.date.toISOString()).toBe("2026-07-04T00:00:00.000Z");
    expect(days[4]!.index).toBe(4);
  });
});

describe("minutesOfDay", () => {
  it("returns local minutes-of-day", () => {
    expect(minutesOfDay(new Date("2026-06-30T09:30:00Z"))).toBe(570);
    expect(minutesOfDay(new Date("2026-06-30T00:00:00Z"))).toBe(0);
  });
});

describe("eventsOnDay", () => {
  it("keeps only events overlapping the given day", () => {
    const a = event({ id: "a" });
    const b = event({
      id: "b",
      start: new Date("2026-07-01T09:00:00Z"),
      end: new Date("2026-07-01T10:00:00Z"),
    });
    const result = eventsOnDay([a, b], DAY);
    expect(result.map(e => e.id)).toEqual(["a"]);
  });
});

describe("isAllDayOnDay / splitDayEvents", () => {
  it("treats the allDay flag as all-day", () => {
    const ev = event({ id: "ad", allDay: true });
    expect(isAllDayOnDay(ev, DAY)).toBe(true);
  });

  it("treats an event covering the whole day as all-day", () => {
    const ev = event({
      id: "multi",
      start: new Date("2026-06-29T00:00:00Z"),
      end: new Date("2026-07-02T00:00:00Z"),
    });
    expect(isAllDayOnDay(ev, DAY)).toBe(true);
  });

  it("partitions a day's events into all-day and timed buckets", () => {
    const timed = event({ id: "timed" });
    const allDay = event({ id: "allday", allDay: true });
    const split = splitDayEvents([timed, allDay], DAY);
    expect(split.timed.map(e => e.id)).toEqual(["timed"]);
    expect(split.allDay.map(e => e.id)).toEqual(["allday"]);
  });
});

describe("layoutTimedEvents", () => {
  it("places non-overlapping events full width in their own lanes", () => {
    const a = event({ id: "a" }); // 09:00-10:00
    const c = event({
      id: "c",
      start: new Date("2026-06-30T11:00:00Z"),
      end: new Date("2026-06-30T12:00:00Z"),
    });
    const blocks = layoutTimedEvents([a, c], DAY);
    const byId = Object.fromEntries(blocks.map(b => [b.event.id, b]));
    expect(byId.a!.laneCount).toBe(1);
    expect(byId.a!.startMin).toBe(540);
    expect(byId.a!.endMin).toBe(600);
    expect(byId.c!.laneCount).toBe(1);
  });

  it("splits overlapping events into side-by-side lanes", () => {
    const a = event({ id: "a" }); // 09:00-10:00
    const b = event({
      id: "b",
      start: new Date("2026-06-30T09:30:00Z"),
      end: new Date("2026-06-30T10:30:00Z"),
    });
    const blocks = layoutTimedEvents([a, b], DAY);
    const byId = Object.fromEntries(blocks.map(x => [x.event.id, x]));
    expect(byId.a!.laneCount).toBe(2);
    expect(byId.b!.laneCount).toBe(2);
    expect(new Set([byId.a!.lane, byId.b!.lane])).toEqual(new Set([0, 1]));
  });

  it("keeps a transitive overlap chain in one 2-lane cluster", () => {
    const a = event({ id: "a" }); // 09:00-10:00
    const b = event({
      id: "b",
      start: new Date("2026-06-30T09:30:00Z"),
      end: new Date("2026-06-30T11:00:00Z"),
    });
    const c = event({
      id: "c",
      start: new Date("2026-06-30T10:30:00Z"),
      end: new Date("2026-06-30T11:30:00Z"),
    });
    const blocks = layoutTimedEvents([a, b, c], DAY);
    expect(new Set(blocks.map(x => x.laneCount))).toEqual(new Set([2]));
    const byId = Object.fromEntries(blocks.map(x => [x.event.id, x]));
    expect(byId.c!.lane).toBe(0); // reuses A's freed lane
  });

  it("treats back-to-back (touching) events as non-overlapping", () => {
    const d = event({
      id: "d",
      start: new Date("2026-06-30T12:00:00Z"),
      end: new Date("2026-06-30T13:00:00Z"),
    });
    const e = event({
      id: "e",
      start: new Date("2026-06-30T13:00:00Z"),
      end: new Date("2026-06-30T14:00:00Z"),
    });
    const blocks = layoutTimedEvents([d, e], DAY);
    expect(blocks.every(b => b.laneCount === 1)).toBe(true);
  });

  it("gives a zero-duration event a minimum visible height", () => {
    const z = event({
      id: "z",
      start: new Date("2026-06-30T09:00:00Z"),
      end: new Date("2026-06-30T09:00:00Z"),
    });
    const [block] = layoutTimedEvents([z], DAY);
    expect(block!.endMin - block!.startMin).toBe(MIN_EVENT_MINUTES);
  });

  it("clamps a multi-day event to the column's own bounds", () => {
    const overnight = event({
      id: "overnight",
      start: new Date("2026-06-29T22:00:00Z"),
      end: new Date("2026-06-30T02:00:00Z"),
    });
    const [block] = layoutTimedEvents([overnight], DAY);
    expect(block!.startMin).toBe(0);
    expect(block!.endMin).toBe(120);
  });
});

describe("computeHourWindow", () => {
  const days = buildTimelineDays(DAY, 5);

  it("uses the defaults when nothing forces expansion", () => {
    const win = computeHourWindow([], days, {
      defaultStartHour: 7,
      defaultEndHour: 21,
      now: new Date("2026-01-01T12:00:00Z"), // not in window
    });
    expect(win).toEqual({ startHour: 7, endHour: 21 });
  });

  it("widens to include early and late events", () => {
    const early = event({
      id: "early",
      start: new Date("2026-06-30T06:00:00Z"),
      end: new Date("2026-06-30T06:30:00Z"),
    });
    const late = event({
      id: "late",
      start: new Date("2026-07-01T21:30:00Z"),
      end: new Date("2026-07-01T22:00:00Z"),
    });
    const win = computeHourWindow([early, late], days, {
      defaultStartHour: 7,
      defaultEndHour: 21,
      now: null,
    });
    expect(win.startHour).toBe(6);
    expect(win.endHour).toBe(22);
  });

  it("expands to include the current time when today is visible", () => {
    const win = computeHourWindow([], days, {
      defaultStartHour: 7,
      defaultEndHour: 21,
      now: new Date("2026-06-30T23:15:00Z"),
    });
    expect(win.endHour).toBe(24);
  });
});

describe("formatHourLabel", () => {
  it("formats whole hours with am/pm", () => {
    expect(formatHourLabel(0)).toBe("12 AM");
    expect(formatHourLabel(7)).toBe("7 AM");
    expect(formatHourLabel(12)).toBe("12 PM");
    expect(formatHourLabel(21)).toBe("9 PM");
    expect(formatHourLabel(24)).toBe("12 AM");
  });
});

