import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import handler from "~~/server/api/chores/missed/index.get";

const { defineEventHandler } = useH3TestUtils();

vi.mock("~/lib/prisma");

type ChoreRow = Awaited<ReturnType<typeof prisma.chore.findMany>>[number];

const mockChore = (o: Partial<ChoreRow>): ChoreRow => ({
  id: "c1",
  title: "Dishes",
  description: null,
  points: 5,
  recurrence: "DAILY",
  daysOfWeek: [],
  order: 0,
  areaId: null,
  startDate: null,
  endDate: null,
  pausedUntil: null,
  rotate: false,
  claimable: false,
  wheelEligible: false,
  rewardId: null,
  active: true,
  createdAt: new Date("2026-05-01"),
  updatedAt: new Date("2026-05-01"),
  ...o,
} as ChoreRow);

describe("gET /api/chores/missed", () => {
  it("is registered as an event handler", () =>
    expect(defineEventHandler).toHaveBeenCalled());

  it("returns active recurring chores by missed due-days, most-missed first", async () => {
    prisma.chore.findMany.mockResolvedValue([
      mockChore({ id: "c1", title: "Dishes", recurrence: "DAILY" }),
      mockChore({ id: "c2", title: "Trash", recurrence: "WEEKLY", daysOfWeek: [1] }),
    ]);
    // groupBy's overloaded generic signature hides the mock helper — cast to reach it.
    (prisma.choreCompletion.groupBy as unknown as { mockResolvedValue: (v: unknown[]) => unknown }).mockResolvedValue([]);

    const event = createMockH3Event({ query: { date: "2026-06-10" } });
    const res = await handler(event);

    expect(res.date).toBe("2026-06-10");
    expect(res.items.every(i => i.missed > 0)).toBe(true);
    // A never-done daily chore is missed far more often than a weekly one.
    expect(res.items[0]!.choreId).toBe("c1");
    expect(res.items[0]!.missed).toBeGreaterThan(res.items[1]!.missed);
  });

  it("throws 400 when the date param is missing", async () => {
    const event = createMockH3Event({ query: {} });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });
});
