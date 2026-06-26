import type { Prisma } from "@prisma/client";

import type { RecurrenceScope } from "~/types/calendar";

import prisma from "~/lib/prisma";

import type { ICalEvent } from "../../integrations/iCal/types";

import { formatICalUTC, makeOccurrenceId, occurrenceTokenToDate, parseOccurrenceId } from "../../utils/recurrence";

const includeUsers = {
  users: {
    include: {
      user: {
        select: { id: true, name: true, avatar: true, color: true },
      },
    },
  },
} satisfies Prisma.CalendarEventInclude;

type EventWithUsers = Prisma.CalendarEventGetPayload<{ include: typeof includeUsers }>;

function serialize(row: EventWithUsers, idOverride?: string) {
  return {
    id: idOverride ?? row.id,
    title: row.title,
    description: row.description,
    start: row.start,
    end: row.end,
    allDay: row.allDay,
    color: row.color as string | string[] | undefined,
    location: row.location,
    ical_event: row.ical_event,
    reminders: row.reminders,
    users: (row.users || []).map(ce => ce.user),
  };
}

export default defineEventHandler(async (event) => {
  try {
    const rawId = getRouterParam(event, "id");
    const body = await readBody(event);
    const { title, description, start, end, allDay, color, location, ical_event, reminders, users } = body;
    const scope = (body.scope as RecurrenceScope) ?? "all";

    if (!rawId) {
      throw createError({
        statusCode: 400,
        message: "Calendar event ID is required",
      });
    }

    const { baseId, occurrenceStart } = parseOccurrenceId(rawId);

    const base = await prisma.calendarEvent.findUnique({ where: { id: baseId } });
    if (!base) {
      throw createError({ statusCode: 404, message: "Calendar event not found" });
    }

    const baseICal = base.ical_event as ICalEvent | null;
    const isRecurring = !!baseICal?.rrule;

    const utcStart = new Date(start);
    const utcEnd = new Date(end);
    const cleanReminders = Array.isArray(reminders)
      ? reminders.filter((m: unknown): m is number => typeof m === "number")
      : [];
    const userCreate = (users as { id: string }[] | undefined)?.map(u => ({ userId: u.id })) || [];
    // Mirror the original handler: pass the object through, or JS null for "no
    // value". (Typed as InputJsonValue so the Prisma data shape type-checks.)
    const jsonOrNull = (v: unknown): Prisma.InputJsonValue => (v ?? null) as Prisma.InputJsonValue;

    // ----- Scope: THIS occurrence → upsert an override child -----
    if (isRecurring && baseICal && occurrenceStart && scope === "this") {
      const recurrenceId = occurrenceTokenToDate(occurrenceStart);
      if (!recurrenceId) {
        throw createError({ statusCode: 400, message: "Invalid occurrence" });
      }

      // Re-adding a previously deleted occurrence: clear it from the parent EXDATE.
      if (baseICal.exdate?.includes(occurrenceStart)) {
        const exdate = baseICal.exdate.filter(t => t !== occurrenceStart);
        await prisma.calendarEvent.update({
          where: { id: baseId },
          data: { ical_event: jsonOrNull({ ...baseICal, exdate }) },
        });
      }

      // An override is a single instance: store no rrule/exdate of its own.
      const overrideICal = ical_event
        ? { ...ical_event, rrule: undefined, exdate: undefined }
        : null;
      const overrideFields = {
        title,
        description,
        start: utcStart,
        end: utcEnd,
        allDay: allDay || false,
        color: color || null,
        location: location || null,
        ical_event: jsonOrNull(overrideICal),
        reminders: cleanReminders,
      };

      const existingOverride = await prisma.calendarEvent.findFirst({
        where: { parentId: baseId, recurrenceId },
      });

      const result = existingOverride
        ? await prisma.calendarEvent.update({
            where: { id: existingOverride.id },
            data: { ...overrideFields, users: { deleteMany: {}, create: userCreate } },
            include: includeUsers,
          })
        : await prisma.calendarEvent.create({
            data: { ...overrideFields, parentId: baseId, recurrenceId, users: { create: userCreate } },
            include: includeUsers,
          });

      return serialize(result, makeOccurrenceId(baseId, formatICalUTC(recurrenceId)));
    }

    // ----- Scope: THIS AND FOLLOWING → split the series -----
    if (isRecurring && baseICal?.rrule && occurrenceStart && scope === "thisAndFollowing") {
      const splitDate = occurrenceTokenToDate(occurrenceStart);
      if (!splitDate) {
        throw createError({ statusCode: 400, message: "Invalid occurrence" });
      }
      const splitMs = splitDate.getTime();

      // Truncate the original series to end just before the split.
      const { count: _count, ...restRrule } = baseICal.rrule;
      const truncatedRrule = { ...restRrule, until: formatICalUTC(new Date(splitMs - 1000)) };
      const baseExdate = (baseICal.exdate ?? []).filter((t) => {
        const d = occurrenceTokenToDate(t);
        return d ? d.getTime() < splitMs : true;
      });
      await prisma.calendarEvent.update({
        where: { id: baseId },
        data: { ical_event: jsonOrNull({ ...baseICal, rrule: truncatedRrule, exdate: baseExdate }) },
      });

      // New series from the split: keep the original cadence (restRrule carries
      // the original UNTIL, if any, and drops COUNT), apply the edited details.
      // A count-based series becomes open-ended past the split — exact remaining
      // count is not preserved.
      const newExdate = (baseICal.exdate ?? []).filter((t) => {
        const d = occurrenceTokenToDate(t);
        return d ? d.getTime() >= splitMs : false;
      });
      const newSeries = await prisma.calendarEvent.create({
        data: {
          title,
          description,
          start: utcStart,
          end: utcEnd,
          allDay: allDay || false,
          color: color || null,
          location: location || null,
          ical_event: jsonOrNull({ ...baseICal, rrule: { ...restRrule }, exdate: newExdate }),
          reminders: cleanReminders,
          users: { create: userCreate },
        },
        include: includeUsers,
      });

      // Re-home override children at/after the split onto the new series.
      await prisma.calendarEvent.updateMany({
        where: { parentId: baseId, recurrenceId: { gte: splitDate } },
        data: { parentId: newSeries.id },
      });

      return serialize(newSeries);
    }

    // ----- Scope: ALL (or non-recurring) → update the base row -----
    const result = await prisma.calendarEvent.update({
      where: { id: baseId },
      data: {
        title,
        description,
        start: utcStart,
        end: utcEnd,
        allDay: allDay || false,
        color: color || null,
        location: location || null,
        ical_event: jsonOrNull(ical_event),
        reminders: cleanReminders,
        users: { deleteMany: {}, create: userCreate },
      },
      include: includeUsers,
    });

    return serialize(result);
  }
  catch (error) {
    // Preserve intended H3 errors (e.g. 404/400) instead of masking as 500.
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      message: `Failed to update calendar event: ${error}`,
    });
  }
});
