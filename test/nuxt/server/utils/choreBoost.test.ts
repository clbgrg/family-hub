import { describe, expect, it } from "vitest";

import { boostFor, computeBoost, neglectStreak } from "~~/server/utils/choreBoost";

const DAILY = { recurrence: "DAILY" as const, daysOfWeek: [] };
const MON = { recurrence: "WEEKLY" as const, daysOfWeek: [1] }; // due Mondays
const ONCE = { recurrence: "ONCE" as const, daysOfWeek: [] };
// 2026-06-14 is a Sunday, so 06-15/06-22/06-29/07-06 are consecutive Mondays.

describe("boostFor", () => {
  it("is 0 below the threshold, steps up, then caps", () => {
    expect(boostFor(0)).toBe(0);
    expect(boostFor(1)).toBe(0); // grace period
    expect(boostFor(2)).toBe(2);
    expect(boostFor(3)).toBe(4);
    expect(boostFor(6)).toBe(10);
    expect(boostFor(7)).toBe(10); // capped
    expect(boostFor(100)).toBe(10);
  });
});

describe("neglectStreak — by recurrence", () => {
  it("never boosts ONCE chores", () => {
    expect(neglectStreak(ONCE, null, "2026-06-17")).toBe(0);
    expect(neglectStreak(ONCE, "2026-01-01", "2026-06-17")).toBe(0);
  });

  it("counts consecutive missed days for DAILY chores", () => {
    expect(neglectStreak(DAILY, "2026-06-16", "2026-06-17")).toBe(0); // done yesterday
    expect(neglectStreak(DAILY, "2026-06-15", "2026-06-17")).toBe(1); // missed 06-16
    expect(neglectStreak(DAILY, "2026-06-14", "2026-06-17")).toBe(2); // missed 06-15, 06-16
  });

  it("counts only scheduled weekdays for WEEKLY chores", () => {
    expect(neglectStreak(MON, "2026-06-15", "2026-06-22")).toBe(0); // no Monday strictly between
    expect(neglectStreak(MON, "2026-06-15", "2026-06-29")).toBe(1); // missed 06-22
    expect(neglectStreak(MON, "2026-06-15", "2026-07-06")).toBe(2); // missed 06-22, 06-29
  });
});

describe("neglectStreak — window awareness & reset", () => {
  it("resets the day after a completion", () => {
    expect(neglectStreak(DAILY, "2026-06-17", "2026-06-18")).toBe(0);
  });

  it("ignores paused days so a vacation pause doesn't accrue neglect", () => {
    // Last done 06-14; paused through 06-16 (active again 06-17); today 06-17.
    const paused = { ...DAILY, pausedUntil: "2026-06-17" };
    expect(neglectStreak(paused, "2026-06-14", "2026-06-17")).toBe(0);
  });

  it("doesn't treat a brand-new chore as neglected, then ramps from creation", () => {
    const fresh = { ...DAILY, createdAt: "2026-06-17" };
    expect(neglectStreak(fresh, null, "2026-06-17")).toBe(0); // created today
    expect(neglectStreak(fresh, null, "2026-06-18")).toBe(1); // one missed day
    expect(neglectStreak(fresh, null, "2026-06-19")).toBe(2); // ramps up
  });
});

describe("computeBoost", () => {
  it("combines the streak with the bonus formula", () => {
    expect(computeBoost(DAILY, "2026-06-16", "2026-06-17")).toBe(0); // streak 0
    expect(computeBoost(DAILY, "2026-06-14", "2026-06-17")).toBe(2); // streak 2 -> +2
    expect(computeBoost(MON, "2026-06-15", "2026-07-06")).toBe(2); // streak 2 -> +2
  });

  it("saturates at the cap for a never-completed chore (bounded lookback)", () => {
    expect(computeBoost(DAILY, null, "2026-06-17")).toBe(10);
  });
});
