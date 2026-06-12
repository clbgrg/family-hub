import type { Badge } from "@prisma/client";

import { beforeAll, describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";

vi.mock("~/lib/prisma");

// badges.ts uses h3's createError via auto-import.
beforeAll(() => {
  vi.stubGlobal("createError", (opts: { statusCode: number; statusMessage: string }) =>
    Object.assign(new Error(opts.statusMessage), opts));
});

const baseBadge = (over: Partial<Badge>): Badge => ({
  id: "b1",
  key: "TEST",
  name: "Test",
  icon: "i-lucide-award",
  description: null,
  conditions: [{ ruleType: "STREAK", threshold: 7 }],
  appliesToUserIds: [],
  order: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
} as Badge);

const stats = { totalCompletions: 10, maxPointsInADay: 50, streak: 7, pointsTotal: 500 };

describe("parseBadgeConditions", () => {
  it("keeps valid conditions and drops malformed ones (fail closed)", async () => {
    const { parseBadgeConditions } = await import("~~/server/utils/badges");
    expect(parseBadgeConditions({ conditions: [
      { ruleType: "STREAK", threshold: 7 },
      { ruleType: "NOT_A_RULE", threshold: 3 },
      { ruleType: "TOTAL_POINTS", threshold: 0 }, // below minimum
      "garbage",
    ] as never })).toEqual([{ ruleType: "STREAK", threshold: 7 }]);
    expect(parseBadgeConditions({ conditions: "not-an-array" as never })).toEqual([]);
  });
});

describe("badgeEarned", () => {
  it("requires EVERY condition (ANDed)", async () => {
    const { badgeEarned } = await import("~~/server/utils/badges");
    const badge = baseBadge({ conditions: [
      { ruleType: "STREAK", threshold: 7 },
      { ruleType: "TOTAL_POINTS", threshold: 501 },
    ] as never });
    expect(badgeEarned(badge, stats, "kid-1")).toBe(false);
    expect(badgeEarned(badge, { ...stats, pointsTotal: 501 }, "kid-1")).toBe(true);
  });

  it("respects appliesToUserIds (empty = everyone)", async () => {
    const { badgeEarned } = await import("~~/server/utils/badges");
    const restricted = baseBadge({ appliesToUserIds: ["kid-2"] });
    expect(badgeEarned(restricted, stats, "kid-1")).toBe(false);
    expect(badgeEarned(restricted, stats, "kid-2")).toBe(true);
    expect(badgeEarned(baseBadge({}), stats, "kid-1")).toBe(true);
  });

  it("never awards a badge with no valid conditions", async () => {
    const { badgeEarned } = await import("~~/server/utils/badges");
    expect(badgeEarned(baseBadge({ conditions: [] as never }), stats, "kid-1")).toBe(false);
  });
});

describe("event-based rules (time + difficulty)", () => {
  const ev = (over: Partial<{ localDate: string; points: number; completedAt: Date }>) => ({
    localDate: "2026-06-08", // a Monday
    points: 10,
    completedAt: new Date("2026-06-08T15:00:00Z"),
    ...over,
  });

  it("eARLY_BIRD counts completions before the hour in the given tz", async () => {
    const { badgeEarned } = await import("~~/server/utils/badges");
    const badge = baseBadge({ conditions: [{ ruleType: "EARLY_BIRD", threshold: 2, beforeHour: 8 }] as never });
    const events = [
      ev({ completedAt: new Date("2026-06-08T06:30:00Z") }), // 06:30 UTC
      ev({ completedAt: new Date("2026-06-08T07:59:00Z") }),
      ev({ completedAt: new Date("2026-06-08T08:00:00Z") }), // not before 8
    ];
    expect(badgeEarned(badge, stats, "kid-1", events, "UTC")).toBe(true);
    expect(badgeEarned(badge, stats, "kid-1", events.slice(0, 1), "UTC")).toBe(false);
    // Same instants in a tz 7 hours behind UTC are 23:30/00:59/01:00 — the
    // second and third land before 8am there, so it still takes two.
    expect(badgeEarned(badge, stats, "kid-1", events, "America/Los_Angeles")).toBe(true);
  });

  it("wEEKEND_COMPLETIONS counts Saturday/Sunday localDates", async () => {
    const { badgeEarned } = await import("~~/server/utils/badges");
    const badge = baseBadge({ conditions: [{ ruleType: "WEEKEND_COMPLETIONS", threshold: 2 }] as never });
    const events = [
      ev({ localDate: "2026-06-06" }), // Saturday
      ev({ localDate: "2026-06-07" }), // Sunday
      ev({ localDate: "2026-06-08" }), // Monday — doesn't count
    ];
    expect(badgeEarned(badge, stats, "kid-1", events)).toBe(true);
    expect(badgeEarned(badge, stats, "kid-1", events.slice(2), "UTC")).toBe(false);
  });

  it("hIGH_VALUE_COMPLETIONS counts tasks worth at least minPoints", async () => {
    const { badgeEarned } = await import("~~/server/utils/badges");
    const badge = baseBadge({ conditions: [{ ruleType: "HIGH_VALUE_COMPLETIONS", threshold: 2, minPoints: 20 }] as never });
    const events = [ev({ points: 25 }), ev({ points: 20 }), ev({ points: 19 })];
    expect(badgeEarned(badge, stats, "kid-1", events)).toBe(true);
    expect(badgeEarned(badge, stats, "kid-1", [ev({ points: 25 }), ev({ points: 19 })])).toBe(false);
  });

  it("rOLLING_AVG_POINTS averages the most recent `window` completions only", async () => {
    const { badgeEarned } = await import("~~/server/utils/badges");
    const badge = baseBadge({ conditions: [{ ruleType: "ROLLING_AVG_POINTS", threshold: 15, window: 3 }] as never });
    // Old low-value tasks followed by three recent 20-pointers: avg of the
    // last 3 is 20 (earned) even though the lifetime avg is below 15.
    const events = [
      ev({ points: 1, completedAt: new Date("2026-06-01T10:00:00Z") }),
      ev({ points: 1, completedAt: new Date("2026-06-02T10:00:00Z") }),
      ev({ points: 20, completedAt: new Date("2026-06-05T10:00:00Z") }),
      ev({ points: 20, completedAt: new Date("2026-06-06T10:00:00Z") }),
      ev({ points: 20, completedAt: new Date("2026-06-07T10:00:00Z") }),
    ];
    expect(badgeEarned(badge, stats, "kid-1", events)).toBe(true);
    // Fewer completions than the window = not earned, no matter the average.
    expect(badgeEarned(badge, stats, "kid-1", events.slice(2, 4))).toBe(false);
  });
});

describe("ensureDefaultBadges", () => {
  // Fresh module = fresh once-per-process seed flag AND a fresh prisma mock
  // instance (resetModules re-evaluates the mock module too — the suite-level
  // `prisma` handle no longer points at what badges.ts sees).
  async function freshBadges() {
    vi.resetModules();
    const { default: prismaMock } = await import("~/lib/__mocks__/prisma");
    const { ensureDefaultBadges } = await import("~~/server/utils/badges");
    return { prismaMock, ensureDefaultBadges };
  }

  it("seeds defaults into an empty table, then never re-checks", async () => {
    const { prismaMock, ensureDefaultBadges } = await freshBadges();
    prismaMock.badge.count.mockResolvedValue(0);

    await ensureDefaultBadges();
    expect(prismaMock.badge.createMany).toHaveBeenCalledTimes(1);

    await ensureDefaultBadges();
    expect(prismaMock.badge.count).toHaveBeenCalledTimes(1); // flag short-circuits
    expect(prismaMock.badge.createMany).toHaveBeenCalledTimes(1);
  });

  it("does NOT reseed a non-empty table (deleted defaults stay deleted)", async () => {
    const { prismaMock, ensureDefaultBadges } = await freshBadges();
    prismaMock.badge.count.mockResolvedValue(3);

    await ensureDefaultBadges();
    expect(prismaMock.badge.count).toHaveBeenCalledTimes(1);
    expect(prismaMock.badge.createMany).not.toHaveBeenCalled();
  });
});

describe("validateBadgeConditions", () => {
  it("rejects an empty array and unknown rule types", async () => {
    const { validateBadgeConditions } = await import("~~/server/utils/badges");
    expect(() => validateBadgeConditions([])).toThrow();
    expect(() => validateBadgeConditions([{ ruleType: "BOGUS", threshold: 1 }])).toThrow();
    expect(() => validateBadgeConditions([{ ruleType: "STREAK", threshold: 0 }])).toThrow();
    expect(validateBadgeConditions([{ ruleType: "STREAK", threshold: "7" }]))
      .toEqual([{ ruleType: "STREAK", threshold: 7 }]);
  });

  it("requires the extra parameter where the rule needs one (and bounds it)", async () => {
    const { validateBadgeConditions } = await import("~~/server/utils/badges");
    expect(() => validateBadgeConditions([{ ruleType: "EARLY_BIRD", threshold: 1 }])).toThrow();
    expect(() => validateBadgeConditions([{ ruleType: "EARLY_BIRD", threshold: 1, beforeHour: 24 }])).toThrow();
    expect(() => validateBadgeConditions([{ ruleType: "HIGH_VALUE_COMPLETIONS", threshold: 5 }])).toThrow();
    expect(() => validateBadgeConditions([{ ruleType: "ROLLING_AVG_POINTS", threshold: 15, window: 0 }])).toThrow();
    expect(validateBadgeConditions([{ ruleType: "EARLY_BIRD", threshold: 1, beforeHour: 0 }]))
      .toEqual([{ ruleType: "EARLY_BIRD", threshold: 1, beforeHour: 0 }]);
    expect(validateBadgeConditions([{ ruleType: "ROLLING_AVG_POINTS", threshold: 15, window: "50" }]))
      .toEqual([{ ruleType: "ROLLING_AVG_POINTS", threshold: 15, window: 50 }]);
  });
});

describe("parseBadgeConditions (event rules)", () => {
  it("drops event rules with a missing or out-of-range extra parameter", async () => {
    const { parseBadgeConditions } = await import("~~/server/utils/badges");
    expect(parseBadgeConditions({ conditions: [
      { ruleType: "EARLY_BIRD", threshold: 1, beforeHour: 8 },
      { ruleType: "EARLY_BIRD", threshold: 1 }, // missing beforeHour
      { ruleType: "HIGH_VALUE_COMPLETIONS", threshold: 3, minPoints: 0 }, // below minimum
      { ruleType: "WEEKEND_COMPLETIONS", threshold: 10 }, // no extra param needed
    ] as never })).toEqual([
      { ruleType: "EARLY_BIRD", threshold: 1, beforeHour: 8 },
      { ruleType: "WEEKEND_COMPLETIONS", threshold: 10 },
    ]);
  });
});
