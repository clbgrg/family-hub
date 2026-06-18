import { describe, expect, it } from "vitest";

import { choreActiveOn, choreDayStatus, daysSinceEpoch, rotationIndex } from "~~/server/utils/choreSchedule";

describe("choreActiveOn", () => {
  it("treats no bounds as always active", () => {
    expect(choreActiveOn("2026-06-17", {})).toBe(true);
  });
  it("respects inclusive start/end and pause", () => {
    expect(choreActiveOn("2026-06-17", { startDate: "2026-06-18" })).toBe(false); // before start
    expect(choreActiveOn("2026-06-18", { startDate: "2026-06-18" })).toBe(true); // on start
    expect(choreActiveOn("2026-06-19", { endDate: "2026-06-18" })).toBe(false); // after end
    expect(choreActiveOn("2026-06-18", { endDate: "2026-06-18" })).toBe(true); // on end
    expect(choreActiveOn("2026-06-17", { pausedUntil: "2026-06-20" })).toBe(false); // paused
    expect(choreActiveOn("2026-06-20", { pausedUntil: "2026-06-20" })).toBe(true); // pause over
  });
});

describe("choreDayStatus window", () => {
  const base = { recurrence: "DAILY" as const, daysOfWeek: [], doneEver: false, doneToday: false, localDate: "2026-06-17" };
  it("is due in-window and never due out-of-window", () => {
    expect(choreDayStatus(base).dueToday).toBe(true);
    expect(choreDayStatus({ ...base, pausedUntil: "2026-06-20" }).dueToday).toBe(false);
    expect(choreDayStatus({ ...base, endDate: "2026-06-10" }).dueToday).toBe(false);
    expect(choreDayStatus({ ...base, startDate: "2026-07-01" }).dueToday).toBe(false);
  });
});

describe("daysSinceEpoch", () => {
  it("is 0 at the epoch and increments one per day", () => {
    expect(daysSinceEpoch("1970-01-01")).toBe(0);
    expect(daysSinceEpoch("2026-06-18") - daysSinceEpoch("2026-06-17")).toBe(1);
  });
});

describe("rotationIndex", () => {
  it("returns 0 for 0 or 1 assignees", () => {
    expect(rotationIndex("DAILY", "2026-06-17", 0)).toBe(0);
    expect(rotationIndex("DAILY", "2026-06-17", 1)).toBe(0);
  });
  it("advances by one each day for DAILY chores", () => {
    const a = rotationIndex("DAILY", "2026-06-17", 3);
    expect(rotationIndex("DAILY", "2026-06-18", 3)).toBe((a + 1) % 3);
    expect(rotationIndex("DAILY", "2026-06-19", 3)).toBe((a + 2) % 3);
    expect(rotationIndex("DAILY", "2026-06-20", 3)).toBe((a + 3) % 3);
  });
  it("holds all week then advances for WEEKLY chores (Sunday-started)", () => {
    // 2026-06-14 is a Sunday; 06-17 is the Wednesday of that week; 06-21 next Sunday.
    const sun = rotationIndex("WEEKLY", "2026-06-14", 3);
    expect(rotationIndex("WEEKLY", "2026-06-17", 3)).toBe(sun); // same owner all week
    expect(rotationIndex("WEEKLY", "2026-06-20", 3)).toBe(sun); // Saturday, still same
    expect(rotationIndex("WEEKLY", "2026-06-21", 3)).toBe((sun + 1) % 3); // next week advances
  });
});
