import consola from "consola";
import ical from "ical.js";

import type { CalendarEvent } from "~/types/calendar";

import prisma from "~/lib/prisma";

import type { ICalEvent } from "../../integrations/iCal/types";

import { formatICalUTC, makeOccurrenceId, occurrenceTokenToDate } from "../../utils/recurrence";

function expandRecurringEvent(
  event: CalendarEvent,
  startDate: Date,
  endDate: Date,
  overridesByInstant: Map<number, number> = new Map(),
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  try {
    if (!event.ical_event?.rrule) {
      return [event];
    }

    // Occurrence instants that should NOT be generated from the base series:
    // EXDATE exclusions + any instant replaced by an override child.
    const excludedInstants = new Set<number>(overridesByInstant.keys());
    for (const token of event.ical_event.exdate ?? []) {
      const t = occurrenceTokenToDate(token)?.getTime();
      if (t != null) {
        excludedInstants.add(t);
      }
    }

    const vevent = new ical.Component(["vevent", [], []]);
    vevent.addPropertyWithValue("uid", event.id);
    vevent.addPropertyWithValue("summary", event.title);
    vevent.addPropertyWithValue("description", event.description);
    vevent.addPropertyWithValue("location", event.location);

    const dtstart = ical.Time.fromJSDate(new Date(event.start), true);
    vevent.addPropertyWithValue("dtstart", dtstart);
    const dtend = ical.Time.fromJSDate(new Date(event.end), true);
    vevent.addPropertyWithValue("dtend", dtend);

    const rrule = new ical.Property("rrule", vevent);
    rrule.setValue(event.ical_event.rrule);
    vevent.addProperty(rrule);

    const expansion = new ical.RecurExpansion({
      component: vevent,
      dtstart,
    });

    let count = 0;
    const maxInstances = 1000;

    while (count < maxInstances) {
      const currentTime = expansion.next();

      if (!currentTime) {
        break;
      }

      const currentDate = currentTime.toJSDate();

      if (currentDate > endDate) {
        break;
      }

      if (currentDate >= startDate) {
        const token = currentTime.toICALString();
        const instant = occurrenceTokenToDate(token)?.getTime();
        // Skip occurrences that are excluded (EXDATE) or replaced by an
        // override child (emitted separately, so the date isn't doubled).
        if (instant != null && excludedInstants.has(instant)) {
          count++;
          continue;
        }
        const duration = new Date(event.end).getTime() - new Date(event.start).getTime();
        const newEnd = new Date(currentDate.getTime() + duration);

        events.push({
          ...event,
          id: makeOccurrenceId(event.id, token),
          start: currentDate,
          end: newEnd,
          ical_event: {
            ...event.ical_event,
            dtstart: ical.Time.fromJSDate(currentDate, true).toString(),
            dtend: ical.Time.fromJSDate(newEnd, true).toString(),
          },
        });
      }
      count++;
    }
  }
  catch (error) {
    consola.warn("Failed to expand recurring event:", error);
    return [event];
  }

  return events;
}

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const now = new Date();
    const startDate = query.start ? new Date(query.start as string) : new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const endDate = query.end ? new Date(query.end as string) : new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());

    const rows = await prisma.calendarEvent.findMany({
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
        reminders: true,
        parentId: true,
        recurrenceId: true,
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
      orderBy: {
        start: "asc",
      },
    });

    type Row = (typeof rows)[number];
    const mapRow = (row: Row): CalendarEvent => ({
      id: row.id,
      title: row.title,
      description: row.description || undefined,
      start: row.start,
      end: row.end,
      allDay: row.allDay,
      color: row.color as string | string[] | undefined,
      location: row.location || undefined,
      ical_event: row.ical_event as ICalEvent | undefined,
      reminders: row.reminders,
      users: row.users.map(ce => ce.user),
    });

    const baseRows = rows.filter(r => r.parentId == null);
    const overrideRows = rows.filter(r => r.parentId != null);
    const parentById = new Map(baseRows.map(r => [r.id, r]));

    // parentId -> set of original-occurrence instants that an override replaces.
    const overridesByParent = new Map<string, Map<number, number>>();
    for (const o of overrideRows) {
      if (!o.parentId || !o.recurrenceId) {
        continue;
      }
      const inst = new Date(o.recurrenceId).getTime();
      const m = overridesByParent.get(o.parentId) ?? new Map<number, number>();
      m.set(inst, 1);
      overridesByParent.set(o.parentId, m);
    }

    const expandedEvents: CalendarEvent[] = [];

    // Base/normal events: recurring ones expand (skipping EXDATEs + overridden
    // slots); single events pass straight through.
    for (const row of baseRows) {
      const overrides = overridesByParent.get(row.id) ?? new Map<number, number>();
      expandedEvents.push(...expandRecurringEvent(mapRow(row), startDate, endDate, overrides));
    }

    // Override instances: emit each once, in the requested window, carrying the
    // parent's rrule so re-editing one still shows the recurring scope picker.
    for (const o of overrideRows) {
      if (!o.parentId || !o.recurrenceId) {
        continue;
      }
      const start = new Date(o.start);
      if (start > endDate || start < startDate) {
        continue;
      }
      const parentICal = parentById.get(o.parentId)?.ical_event as ICalEvent | undefined;
      const mapped = mapRow(o);
      expandedEvents.push({
        ...mapped,
        id: makeOccurrenceId(o.parentId, formatICalUTC(new Date(o.recurrenceId))),
        ical_event: parentICal
          ? {
              ...parentICal,
              dtstart: ical.Time.fromJSDate(start, true).toString(),
              dtend: ical.Time.fromJSDate(new Date(o.end), true).toString(),
            }
          : mapped.ical_event,
      });
    }

    return expandedEvents.sort((a, b) =>
      new Date(a.start).getTime() - new Date(b.start).getTime(),
    );
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to fetch calendar events: ${error}`,
    });
  }
});
