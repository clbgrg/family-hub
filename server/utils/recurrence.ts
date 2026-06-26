// Occurrence-id helpers for recurring calendar events.
//
// A recurring series is a single CalendarEvent row; occurrences are expanded
// virtually (see server/api/calendar-events/index.get.ts) and stamped with a
// synthetic id `${baseId}-${token}` where the token is ical.js
// Time.toICALString() — "YYYYMMDD" (all-day) or "YYYYMMDDTHHMMSSZ" (datetime,
// always UTC in our expansion). Base ids are CUIDs, which never contain a dash,
// so the FIRST dash cleanly separates base id from occurrence token.
//
// This module is intentionally pure (no node/ical deps): ical<->token
// conversion is done by parsing the fixed token format directly as UTC. That
// keeps occurrence matching internally consistent across the expansion, the
// EXDATE exclusions and the per-occurrence overrides — they all key off
// occurrenceTokenToDate(token).getTime() computed from the SAME token format.

const OCCURRENCE_TOKEN = /^\d{8}(?:T\d{6}Z?)?$/;

export function makeOccurrenceId(
  baseId: string,
  time: string | { toICALString: () => string },
): string {
  const token = typeof time === "string" ? time : time.toICALString();
  return `${baseId}-${token}`;
}

export function parseOccurrenceId(id: string): {
  baseId: string;
  occurrenceStart: string | null;
} {
  const dash = id.indexOf("-"); // split on the FIRST dash only
  if (dash === -1) {
    return { baseId: id, occurrenceStart: null };
  }
  const suffix = id.slice(dash + 1);
  if (OCCURRENCE_TOKEN.test(suffix)) {
    return { baseId: id.slice(0, dash), occurrenceStart: suffix };
  }
  // Suffix isn't a date token → treat the whole id as a (non-occurrence) base.
  return { baseId: id, occurrenceStart: null };
}

// Parse an occurrence token ("YYYYMMDD" or "YYYYMMDDTHHMMSS[Z]") to a Date.
// Our synthesized tokens are always UTC, so parse as UTC for determinism.
export function occurrenceTokenToDate(token: string): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/.exec(token);
  if (!m) {
    return null;
  }
  const [, y, mo, d, hh, mm, ss] = m;
  return new Date(Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(hh ?? "0"),
    Number(mm ?? "0"),
    Number(ss ?? "0"),
  ));
}

// Format a Date as an iCal UTC datetime token "YYYYMMDDTHHMMSSZ" (used for
// rrule UNTIL when truncating a series).
export function formatICalUTC(date: Date): string {
  const p = (n: number, w = 2): string => String(n).padStart(w, "0");
  return (
    `${p(date.getUTCFullYear(), 4)}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}`
    + `T${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}Z`
  );
}
