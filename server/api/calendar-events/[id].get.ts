import prisma from "~/lib/prisma";

import { parseOccurrenceId } from "../../utils/recurrence";

export default defineEventHandler(async (event) => {
  try {
    const rawId = getRouterParam(event, "id");

    if (!rawId) {
      throw createError({
        statusCode: 400,
        message: "Calendar event ID is required",
      });
    }

    // An occurrence id (`${baseId}-${token}`) resolves to its base series row;
    // the dialog overlays the specific occurrence's start/end itself.
    const { baseId } = parseOccurrenceId(rawId);

    const calendarEvent = await prisma.calendarEvent.findUnique({
      where: { id: baseId },
      select: {
        id: true,
        title: true,
        description: true,
        start: true,
        end: true,
        allDay: true,
        color: true,
        location: true,
        ical_event: true,
        users: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
                color: true,
              },
            },
          },
        },
      },
    });

    if (!calendarEvent) {
      throw createError({
        statusCode: 404,
        message: "Calendar event not found",
      });
    }

    return {
      id: calendarEvent.id,
      title: calendarEvent.title,
      description: calendarEvent.description,
      start: calendarEvent.start,
      end: calendarEvent.end,
      allDay: calendarEvent.allDay,
      color: calendarEvent.color as string | string[] | undefined,
      location: calendarEvent.location,
      ical_event: calendarEvent.ical_event,
      users: (calendarEvent.users || []).map(ce => ce.user),
    };
  }
  catch (error) {
    // Preserve intended H3 errors (e.g. 404/400) instead of masking as 500.
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      message: `Failed to fetch calendar event: ${error}`,
    });
  }
});
