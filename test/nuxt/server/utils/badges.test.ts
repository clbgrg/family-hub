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
});
