import { describe, expect, it } from "vitest";

import {
  formatICalUTC,
  makeOccurrenceId,
  occurrenceTokenToDate,
  parseOccurrenceId,
} from "../../../../server/utils/recurrence";

const CUID = "clx7h1q0f000108l4k8z8"; // realistic, dashless base id
const TOKEN = "20250115T100000Z";

describe("makeOccurrenceId", () => {
  it("joins base id and a string token", () => {
    expect(makeOccurrenceId(CUID, TOKEN)).toBe(`${CUID}-${TOKEN}`);
  });

  it("accepts an ical Time-like object", () => {
    expect(makeOccurrenceId(CUID, { toICALString: () => TOKEN })).toBe(`${CUID}-${TOKEN}`);
  });
});

describe("parseOccurrenceId", () => {
  it("treats a plain (dashless) id as a base with no occurrence", () => {
    expect(parseOccurrenceId(CUID)).toEqual({ baseId: CUID, occurrenceStart: null });
  });

  it("splits an occurrence id on the first dash", () => {
    expect(parseOccurrenceId(`${CUID}-${TOKEN}`)).toEqual({
      baseId: CUID,
      occurrenceStart: TOKEN,
    });
  });

  it("parses an all-day (date-only) occurrence token", () => {
    expect(parseOccurrenceId(`${CUID}-20250115`)).toEqual({
      baseId: CUID,
      occurrenceStart: "20250115",
    });
  });

  it("treats a non-date suffix as part of the base id", () => {
    expect(parseOccurrenceId("foo-bar")).toEqual({ baseId: "foo-bar", occurrenceStart: null });
  });

  it("round-trips with makeOccurrenceId", () => {
    const id = makeOccurrenceId(CUID, TOKEN);
    const { baseId, occurrenceStart } = parseOccurrenceId(id);
    expect(baseId).toBe(CUID);
    expect(occurrenceStart).toBe(TOKEN);
  });
});

describe("occurrenceTokenToDate", () => {
  it("parses a datetime token as UTC", () => {
    expect(occurrenceTokenToDate(TOKEN)?.getTime()).toBe(Date.UTC(2025, 0, 15, 10, 0, 0));
  });

  it("parses an all-day token as UTC midnight", () => {
    expect(occurrenceTokenToDate("20250115")?.getTime()).toBe(Date.UTC(2025, 0, 15, 0, 0, 0));
  });

  it("returns null for garbage", () => {
    expect(occurrenceTokenToDate("not-a-date")).toBeNull();
  });
});

describe("formatICalUTC", () => {
  it("formats a Date as an iCal UTC datetime token", () => {
    expect(formatICalUTC(new Date(Date.UTC(2025, 0, 15, 9, 59, 59)))).toBe("20250115T095959Z");
  });

  it("round-trips through occurrenceTokenToDate", () => {
    const d = new Date(Date.UTC(2026, 5, 25, 14, 30, 0));
    expect(occurrenceTokenToDate(formatICalUTC(d))?.getTime()).toBe(d.getTime());
  });
});
