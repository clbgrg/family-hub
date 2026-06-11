import type { Mock } from "vitest";

import { describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import { computeAllRewardBalances, computeRewardBalance } from "~~/server/utils/rewardBalance";

vi.mock("~/lib/prisma");

// Prisma's groupBy is a generic overload mockDeep can't surface mock methods
// on — view it as a plain Mock for stubbing.
const asMock = (fn: unknown): Mock => fn as Mock;

describe("computeRewardBalance", () => {
  it("sums chore + school + adjustments minus approved and pending spend, flooring available at 0", async () => {
    prisma.choreCompletion.aggregate.mockResolvedValue({ _sum: { points: 30 } } as never);
    prisma.schoolItemCompletion.aggregate.mockResolvedValue({ _sum: { points: 10 } } as never);
    prisma.pointAdjustment.aggregate.mockResolvedValue({ _sum: { delta: -20 } } as never);
    prisma.redemption.aggregate
      .mockResolvedValueOnce({ _sum: { pointsCost: 15 } } as never) // APPROVED
      .mockResolvedValueOnce({ _sum: { pointsCost: 10 } } as never); // PENDING

    await expect(computeRewardBalance("kid-1")).resolves.toEqual({
      userId: "kid-1",
      earned: 20,
      approvedSpent: 15,
      pendingSpent: 10,
      available: 0, // 20 - 15 - 10 = -5 → floored
    });
  });
});

describe("computeAllRewardBalances", () => {
  it("derives every user's balance from five grouped queries", async () => {
    asMock(prisma.choreCompletion.groupBy).mockResolvedValue([
      { userId: "kid-1", _sum: { points: 50 } },
      { userId: "kid-2", _sum: { points: 5 } },
    ]);
    asMock(prisma.schoolItemCompletion.groupBy).mockResolvedValue([
      { userId: "kid-1", _sum: { points: 10 } },
    ]);
    asMock(prisma.pointAdjustment.groupBy).mockResolvedValue([
      { userId: "kid-1", _sum: { delta: -20 } },
    ]);
    asMock(prisma.redemption.groupBy)
      .mockResolvedValueOnce([{ userId: "kid-1", _sum: { pointsCost: 25 } }]) // APPROVED
      .mockResolvedValueOnce([]); // PENDING

    const balances = await computeAllRewardBalances(["kid-1", "kid-2", "kid-3"]);

    expect(balances).toEqual([
      { userId: "kid-1", earned: 40, approvedSpent: 25, pendingSpent: 0, available: 15 },
      { userId: "kid-2", earned: 5, approvedSpent: 0, pendingSpent: 0, available: 5 },
      // No rows anywhere → clean zero balance, still present in the output.
      { userId: "kid-3", earned: 0, approvedSpent: 0, pendingSpent: 0, available: 0 },
    ]);
    // One grouped query per table regardless of user count.
    expect(prisma.choreCompletion.groupBy).toHaveBeenCalledTimes(1);
    expect(prisma.redemption.groupBy).toHaveBeenCalledTimes(2); // approved + pending
  });
});
