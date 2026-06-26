import type { Prisma } from "@prisma/client";

import type { RecurrenceScope } from "~/types/calendar";

import prisma from "~/lib/prisma";

import type { ICalEvent } from "../../integrations/iCal/types";

import { formatICalUTC, occurrenceTokenToDate, parseOccurrenceId } from "../../utils/recurrence";

export default defineEventHandler(async (event) => {
  try {
    const rawId = getRouterParam(event, "id");

    if (!rawId) {
      throw createError({
        statusCode: 400,
        message: "Calendar event ID is required",
      });
    }

    const { baseId, occurrenceStart } = parseOccurrenceId(rawId);
    const scope = (getQuery(event).scope as RecurrenceScope) ?? "all";

    const existing = await prisma.calendarEvent.findUnique({
      where: { id: baseId },
    });

    if (!existing) {
      throw createError({
        statusCode: 404,
        message: "Calendar event not found",
      });
    }

    const ical = existing.ical_event as ICalEvent | null;
    const isRecurring = !!ical?.rrule;

    // Per-occurrence scopes apply only to a real recurring series with a known
    // occurrence; everything else falls through to a full-series delete.
    if (isRecurring && ical && occurrenceStart && scope !== "all") {
      const splitDate = occurrenceTokenToDate(occurrenceStart);

      if (scope === "this") {
        // Exclude this occurrence (EXDATE) and drop any override standing in
        // for it.
        const exdate = Array.from(new Set([...(ical.exdate ?? []), occurrenceStart]));
        if (splitDate) {
          await prisma.calendarEvent.deleteMany({
            where: { parentId: baseId, recurrenceId: splitDate },
          });
        }
        await prisma.calendarEvent.update({
          where: { id: baseId },
          data: { ical_event: { ...ical, exdate } as unknown as Prisma.InputJsonValue },
        });
        return { success: true, message: "This event was removed from the series" };
      }

      if (scope === "thisAndFollowing" && splitDate) {
        // Truncate the series just before this occurrence, and remove any
        // override children at or after the split.
        const { count: _count, ...restRrule } = ical.rrule ?? { freq: "" };
        const newRrule = { ...restRrule, until: formatICalUTC(new Date(splitDate.getTime() - 1000)) };
        const exdate = (ical.exdate ?? []).filter((t) => {
          const d = occurrenceTokenToDate(t);
          return d ? d.getTime() < splitDate.getTime() : true;
        });
        await prisma.calendarEvent.deleteMany({
          where: { parentId: baseId, recurrenceId: { gte: splitDate } },
        });
        await prisma.calendarEvent.update({
          where: { id: baseId },
          data: { ical_event: { ...ical, rrule: newRrule, exdate } as unknown as Prisma.InputJsonValue },
        });
        return { success: true, message: "This and following events were removed" };
      }
    }

    // "all" (or non-recurring): delete the base row. Override children and all
    // CalendarEventUser join rows cascade (onDelete: Cascade).
    await prisma.calendarEvent.delete({
      where: { id: baseId },
    });

    return {
      success: true,
      message: isRecurring ? "Entire recurring series deleted" : "Event deleted successfully",
    };
  }
  catch (error) {
    // Preserve intended H3 errors (e.g. 404/400) instead of masking as 500.
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      message: `Failed to delete calendar event: ${error}`,
    });
  }
});
