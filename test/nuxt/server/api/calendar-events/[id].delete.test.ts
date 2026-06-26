import type { CalendarEvent } from "@prisma/client";

import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import handler from "~~/server/api/calendar-events/[id].delete";

const { defineEventHandler } = useH3TestUtils();

vi.mock("~/lib/prisma");

// Realistic CUID base id (no dashes — the invariant the occurrence-id parser
// relies on). Occurrence ids are `${BASE}-${icalToken}`.
const BASE = "clx7h1q0f000108l4k8z8";
const TOKEN = "20250115T100000Z";
const OCCURRENCE_ID = `${BASE}-${TOKEN}`;

describe("dELETE /api/calendar-events/[id]", () => {
  it("is registered as an event handler", () =>
    expect(defineEventHandler).toHaveBeenCalled());

  const createBaseEvent = (overrides = {}): CalendarEvent => ({
    id: BASE,
    title: "Test Event",
    description: "Test Description",
    start: new Date("2025-01-15T10:00:00Z"),
    end: new Date("2025-01-15T11:00:00Z"),
    allDay: false,
    color: null,
    location: null,
    ical_event: null,
    reminders: [],
    parentId: null,
    recurrenceId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as CalendarEvent);

  const recurringEvent = (overrides = {}) =>
    createBaseEvent({ ical_event: { rrule: { freq: "DAILY", interval: 1 } }, ...overrides });

  describe("behavior", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("deletes a single (non-recurring) event", async () => {
      prisma.calendarEvent.findUnique.mockResolvedValue(createBaseEvent());
      prisma.calendarEvent.delete.mockResolvedValue(createBaseEvent());

    const response = await handler(createMockH3Event({ params: { id: BASE } }));

    expect(prisma.calendarEvent.findUnique).toHaveBeenCalledWith({ where: { id: BASE } });
    expect(prisma.calendarEvent.delete).toHaveBeenCalledWith({ where: { id: BASE } });
    expect(response).toEqual({ success: true, message: "Event deleted successfully" });
  });

  it("deletes the whole series (occurrence id, scope=all)", async () => {
    prisma.calendarEvent.findUnique.mockResolvedValue(recurringEvent());
    prisma.calendarEvent.delete.mockResolvedValue(recurringEvent());

    const response = await handler(
      createMockH3Event({ params: { id: OCCURRENCE_ID }, query: { scope: "all" } }),
    );

    // Occurrence id resolves to the base series row for the delete.
    expect(prisma.calendarEvent.delete).toHaveBeenCalledWith({ where: { id: BASE } });
    expect(response).toEqual({ success: true, message: "Entire recurring series deleted" });
  });

  it("scope=this excludes the occurrence (EXDATE) instead of deleting", async () => {
    prisma.calendarEvent.findUnique.mockResolvedValue(recurringEvent());

    const response = await handler(
      createMockH3Event({ params: { id: OCCURRENCE_ID }, query: { scope: "this" } }),
    );

    expect(prisma.calendarEvent.delete).not.toHaveBeenCalled();
    expect(prisma.calendarEvent.deleteMany).toHaveBeenCalledWith({
      where: { parentId: BASE, recurrenceId: new Date(Date.UTC(2025, 0, 15, 10, 0, 0)) },
    });
    expect(prisma.calendarEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BASE },
        data: expect.objectContaining({
          ical_event: expect.objectContaining({ exdate: [TOKEN] }),
        }),
      }),
    );
    expect(response).toEqual({ success: true, message: "This event was removed from the series" });
  });

  it("scope=thisAndFollowing truncates the series with UNTIL", async () => {
    prisma.calendarEvent.findUnique.mockResolvedValue(recurringEvent());

    const response = await handler(
      createMockH3Event({ params: { id: OCCURRENCE_ID }, query: { scope: "thisAndFollowing" } }),
    );

    expect(prisma.calendarEvent.delete).not.toHaveBeenCalled();
    expect(prisma.calendarEvent.deleteMany).toHaveBeenCalledWith({
      where: { parentId: BASE, recurrenceId: { gte: new Date(Date.UTC(2025, 0, 15, 10, 0, 0)) } },
    });
    // UNTIL = one second before the occurrence start.
    expect(prisma.calendarEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BASE },
        data: expect.objectContaining({
          ical_event: expect.objectContaining({
            rrule: expect.objectContaining({ until: "20250115T095959Z" }),
          }),
        }),
      }),
    );
    expect(response).toEqual({ success: true, message: "This and following events were removed" });
  });

  describe("error handling", () => {
    it("throws 400 when id is missing", async () => {
      await expect(handler(createMockH3Event({ params: {} }))).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("throws 404 (not 500) when event not found", async () => {
      prisma.calendarEvent.findUnique.mockResolvedValue(null);
      await expect(
        handler(createMockH3Event({ params: { id: "nonexistent" } })),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("handles database errors", async () => {
      prisma.calendarEvent.findUnique.mockResolvedValue(createBaseEvent());
      prisma.calendarEvent.delete.mockRejectedValue(new Error("Database error"));
      await expect(
        handler(createMockH3Event({ params: { id: BASE } })),
      ).rejects.toThrow();
    });
  });
  });
});
