import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import handler from "~~/server/api/chores/points-series/index.get";

const { defineEventHandler } = useH3TestUtils();

vi.mock("~/lib/prisma");

const mockUser = (o: Partial<{ id: string; name: string; color: string | null }>) => ({
  id: "test-user",
  name: "Kid",
  email: null,
  avatar: null,
  color: null,
  todoOrder: 0,
  role: "MEMBER" as const,
  pinHash: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...o,
});
const mockCompletion = (o: Partial<{ userId: string; localDate: string; points: number }>) => ({
  id: "c",
  userId: "test-user",
  choreId: "chore",
  completedById: null,
  localDate: "2026-06-10",
  points: 0,
  completedAt: new Date(),
  ...o,
});

describe("gET /api/chores/points-series", () => {
  it("is registered as an event handler", () =>
    expect(defineEventHandler).toHaveBeenCalled());

  it("buckets a member's chore points per day, scoped to themselves", async () => {
    prisma.user.findMany.mockResolvedValue([mockUser({ id: "test-user", name: "Kid" })]);
    prisma.choreCompletion.findMany.mockResolvedValue([
      mockCompletion({ userId: "test-user", localDate: "2026-06-08", points: 5 }),
      mockCompletion({ userId: "test-user", localDate: "2026-06-10", points: 3 }),
      mockCompletion({ userId: "test-user", localDate: "2026-06-10", points: 2 }),
    ]);

    const event = createMockH3Event({ query: { date: "2026-06-10", days: "3" } });
    const res = await handler(event);

    // A MEMBER is scoped to their own completions regardless of any ?userId.
    expect(prisma.choreCompletion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: "test-user" }) }),
    );
    expect(res.dates).toEqual(["2026-06-08", "2026-06-09", "2026-06-10"]);
    expect(res.series).toHaveLength(1);
    expect(res.series[0]).toMatchObject({ userId: "test-user", name: "Kid", points: [5, 0, 5] });
  });

  it("throws 400 when the date param is missing", async () => {
    const event = createMockH3Event({ query: {} });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });
});
