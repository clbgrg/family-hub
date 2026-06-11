import { beforeAll, describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import { addDays, choreDayStatus, weekStart } from "~~/server/utils/choreSchedule";
import { computeAllUserStats, isAllDoneToday, statsFromEvents } from "~~/server/utils/choreStats";

vi.mock("~/lib/prisma");

// choreStats uses these via Nitro auto-imports; provide them in the test env.
beforeAll(() => {
  vi.stubGlobal("weekStart", weekStart);
  vi.stubGlobal("addDays", addDays);
  vi.stubGlobal("choreDayStatus", choreDayStatus);
});

// 2026-06-10 is a Wednesday; its Sunday-started week is 06-07..06-13.
const TODAY = "2026-06-10";

describe("statsFromEvents", () => {
  it("returns all zeros for no events", () => {
    expect(statsFromEvents([], [], TODAY)).toEqual({
      pointsTotal: 0,
      pointsToday: 0,
      pointsWeek: 0,
      pointsTotalRaw: 0,
      streak: 0,
      totalCompletions: 0,
      maxPointsInADay: 0,
      adjustmentsTotal: 0,
    });
  });

  it("buckets completion points into total / today / week", () => {
    const completions = [
      { localDate: "2026-06-10", points: 10 }, // today
      { localDate: "2026-06-08", points: 5 }, // this week
      { localDate: "2026-06-01", points: 20 }, // older
    ];
    const stats = statsFromEvents(completions, [], TODAY);
    expect(stats.pointsTotal).toBe(35);
    expect(stats.pointsToday).toBe(10);
    expect(stats.pointsWeek).toBe(15);
    expect(stats.totalCompletions).toBe(3);
    expect(stats.maxPointsInADay).toBe(20);
  });

  it("counts a streak ending today", () => {
    const completions = ["2026-06-10", "2026-06-09", "2026-06-08", "2026-06-06"]
      .map(localDate => ({ localDate, points: 1 }));
    expect(statsFromEvents(completions, [], TODAY).streak).toBe(3);
  });

  it("keeps yesterday's streak alive before today's chores are done", () => {
    const completions = ["2026-06-09", "2026-06-08"].map(localDate => ({ localDate, points: 1 }));
    expect(statsFromEvents(completions, [], TODAY).streak).toBe(2);
  });

  it("breaks the streak after a missed day", () => {
    const completions = ["2026-06-07", "2026-06-06"].map(localDate => ({ localDate, points: 1 }));
    expect(statsFromEvents(completions, [], TODAY).streak).toBe(0);
  });

  it("folds adjustments into displayed totals only — never streaks, counts, or raw points", () => {
    const completions = [{ localDate: "2026-06-10", points: 10 }];
    const adjustments = [
      { localDate: "2026-06-10", points: -20 },
      { localDate: "2026-06-01", points: 5 },
    ];
    const stats = statsFromEvents(completions, adjustments, TODAY);
    expect(stats.pointsTotal).toBe(-5); // 10 - 20 + 5
    expect(stats.pointsToday).toBe(-10); // 10 - 20
    expect(stats.pointsWeek).toBe(-10);
    expect(stats.pointsTotalRaw).toBe(10); // badges see this
    expect(stats.adjustmentsTotal).toBe(-15);
    expect(stats.streak).toBe(1);
    expect(stats.totalCompletions).toBe(1);
    expect(stats.maxPointsInADay).toBe(10);
  });
});

describe("computeAllUserStats", () => {
  it("groups batched rows per user and pools chore + school completions", async () => {
    prisma.choreCompletion.findMany.mockResolvedValue([
      { userId: "kid-1", localDate: "2026-06-10", points: 10 },
      { userId: "kid-2", localDate: "2026-06-10", points: 7 },
    ] as never);
    prisma.schoolItemCompletion.findMany.mockResolvedValue([
      { userId: "kid-1", localDate: "2026-06-10", points: 5 },
    ] as never);
    prisma.pointAdjustment.findMany.mockResolvedValue([
      { userId: "kid-1", localDate: "2026-06-10", delta: -3 },
    ] as never);

    const stats = await computeAllUserStats(["kid-1", "kid-2", "kid-3"], TODAY);

    expect(stats.get("kid-1")).toMatchObject({ pointsToday: 12, pointsTotalRaw: 15, totalCompletions: 2 });
    expect(stats.get("kid-2")).toMatchObject({ pointsToday: 7, totalCompletions: 1 });
    // A user with no events still gets a (zeroed) entry.
    expect(stats.get("kid-3")).toMatchObject({ pointsTotal: 0, streak: 0 });
    // One batched query per table, not per user.
    expect(prisma.choreCompletion.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.schoolItemCompletion.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.pointAdjustment.findMany).toHaveBeenCalledTimes(1);
  });
});

describe("isAllDoneToday", () => {
  const chore = (over: Record<string, unknown>) => ({
    id: "c1",
    recurrence: "DAILY",
    daysOfWeek: [],
    completions: [],
    ...over,
  });

  it("is false when nothing is due (not vacuously true)", async () => {
    prisma.chore.findMany.mockResolvedValue([] as never);
    await expect(isAllDoneToday("kid-1", TODAY)).resolves.toBe(false);
  });

  it("is true only when every due chore is completed today", async () => {
    prisma.chore.findMany.mockResolvedValue([
      chore({ id: "c1", completions: [{ localDate: TODAY }] }),
      chore({ id: "c2", completions: [] }),
    ] as never);
    await expect(isAllDoneToday("kid-1", TODAY)).resolves.toBe(false);

    prisma.chore.findMany.mockResolvedValue([
      chore({ id: "c1", completions: [{ localDate: TODAY }] }),
      chore({ id: "c2", completions: [{ localDate: TODAY }] }),
    ] as never);
    await expect(isAllDoneToday("kid-1", TODAY)).resolves.toBe(true);
  });

  it("treats a ONCE chore completed on an earlier day as done (not due)", async () => {
    prisma.chore.findMany.mockResolvedValue([
      chore({ id: "once-1", recurrence: "ONCE", completions: [] }),
      chore({ id: "daily-1", completions: [{ localDate: TODAY }] }),
    ] as never);
    // The ONCE chore has a historical completion → drops out of today's set.
    prisma.choreCompletion.findMany.mockResolvedValue([{ choreId: "once-1" }] as never);

    await expect(isAllDoneToday("kid-1", TODAY)).resolves.toBe(true);
    expect(prisma.choreCompletion.findMany).toHaveBeenCalledWith({
      where: { userId: "kid-1", choreId: { in: ["once-1"] } },
      select: { choreId: true },
    });
  });
});
