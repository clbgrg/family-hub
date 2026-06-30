import { mountSuspended } from "@nuxt/test-utils/runtime";
import { describe, expect, it } from "vitest";

import type { CalendarEvent } from "~/types/calendar";

import CalendarFiveDayTimeline from "../../../../../app/components/calendar/calendarFiveDayTimeline.vue";

const START = new Date("2026-06-30T00:00:00Z");

function baseEvent(overrides: Partial<CalendarEvent> & { id: string }): CalendarEvent {
  return {
    title: "Soccer practice",
    start: new Date("2026-06-30T17:00:00Z"),
    end: new Date("2026-06-30T18:00:00Z"),
    allDay: false,
    users: [],
    ...overrides,
  } as CalendarEvent;
}

describe("CalendarFiveDayTimeline", () => {
  it("renders a timed event's title", async () => {
    const wrapper = await mountSuspended(CalendarFiveDayTimeline, {
      props: { events: [baseEvent({ id: "e1" })], startDate: START },
    });
    expect(wrapper.text()).toContain("Soccer practice");
  });

  it("renders all-day events in an all-day rail", async () => {
    const wrapper = await mountSuspended(CalendarFiveDayTimeline, {
      props: {
        events: [
          baseEvent({
            id: "ad",
            title: "Mom's birthday",
            allDay: true,
            start: new Date("2026-06-30T00:00:00Z"),
            end: new Date("2026-07-01T00:00:00Z"),
          }),
        ],
        startDate: START,
      },
    });
    expect(wrapper.text()).toContain("All-day");
    expect(wrapper.text()).toContain("Mom's birthday");
  });

  it("renders the hour rail even with no events", async () => {
    const wrapper = await mountSuspended(CalendarFiveDayTimeline, {
      props: { events: [], startDate: START },
    });
    // Default window is 7 AM–9 PM, so hour labels are present.
    expect(wrapper.text()).toContain("AM");
    expect(wrapper.text()).toContain("PM");
  });
});
