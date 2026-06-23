import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import handler from "~~/server/api/alerts/index.get";

const { defineEventHandler } = useH3TestUtils();

vi.mock("~/lib/prisma");

// findMany on these models is generically overloaded — cast to reach the mock.
function mockResolved(fn: unknown, value: unknown) {
  (fn as { mockResolvedValue: (v: unknown) => unknown }).mockResolvedValue(value);
}

function eventRow(over: Record<string, unknown> = {}) {
  return {
    id: "e1",
    title: "Dentist",
    start: new Date(Date.now() + 30 * 60_000), // 30 min from now
    reminders: [60],
    users: [],
    ...over,
  };
}

describe("gET /api/alerts", () => {
  it("is registered as an event handler", () =>
    expect(defineEventHandler).toHaveBeenCalled());

  it("surfaces an event reminder once now is inside its window", async () => {
    mockResolved(prisma.calendarEvent.findMany, [eventRow()]);
    mockResolved(prisma.redemption.findMany, []);

    const res = await handler(createMockH3Event({}));

    expect(res.alerts.some(a => a.type === "EVENT_REMINDER" && a.title === "Dentist")).toBe(true);
  });

  it("does not surface an event whose reminder window hasn't opened yet", async () => {
    // Starts in 30 min but only a 10-min reminder → still too early.
    mockResolved(prisma.calendarEvent.findMany, [eventRow({ reminders: [10] })]);
    mockResolved(prisma.redemption.findMany, []);

    const res = await handler(createMockH3Event({}));

    expect(res.alerts.some(a => a.type === "EVENT_REMINDER")).toBe(false);
  });
});
