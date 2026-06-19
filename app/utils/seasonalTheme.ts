import type { ThemeName } from "~/types/ui";

/**
 * Anonymous Gregorian computus — the date of Easter Sunday for a given year.
 * Returns a 1-based month (3 = March, 4 = April) and day. Pure + dependency-free
 * so it can be unit-tested directly.
 */
export function computus(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

/** The date of the nth given weekday in a month (weekday: 0 = Sun … 6 = Sat). */
function nthWeekdayOfMonth(year: number, month1: number, weekday: number, n: number): Date {
  const first = new Date(year, month1 - 1, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month1 - 1, 1 + offset + (n - 1) * 7);
}

/**
 * Map a local date to the seasonal theme in effect, or `null` off-season.
 * Windows don't overlap; the first match wins. Used when the device theme is
 * "auto" (or when the global auto-seasonal setting is on and the device is on
 * the default theme).
 */
export function seasonalThemeFor(input: Date = new Date()): ThemeName | null {
  // Compare on calendar date only (drop any time component).
  const date = new Date(input.getFullYear(), input.getMonth(), input.getDate());
  const y = date.getFullYear();
  const md = (date.getMonth() + 1) * 100 + date.getDate(); // MMDD
  const inRange = (start: number, end: number) => md >= start && md <= end;
  const between = (a: Date, b: Date) => date >= a && date <= b;

  // New Year's: Dec 31 – Jan 2 (wraps the year boundary).
  if (md >= 1231 || md <= 102)
    return "newyears";
  // Valentine's: Feb 7 – 14.
  if (inRange(207, 214))
    return "valentines";
  // St. Patrick's: Mar 13 – 17.
  if (inRange(313, 317))
    return "stpatricks";

  // Easter: the (movable) Holy Week up to & including Easter Sunday.
  const e = computus(y);
  const easter = new Date(y, e.month - 1, e.day);
  const easterStart = new Date(y, e.month - 1, e.day - 6);
  if (between(easterStart, easter))
    return "easter";

  // Independence Day: Jul 1 – 4.
  if (inRange(701, 704))
    return "independence";
  // Halloween: Oct 24 – 31.
  if (inRange(1024, 1031))
    return "halloween";

  // Thanksgiving (US): the week up to & including the 4th Thursday of November.
  const thanks = nthWeekdayOfMonth(y, 11, 4 /* Thu */, 4);
  const thanksStart = new Date(y, 10, thanks.getDate() - 4);
  if (between(thanksStart, thanks))
    return "thanksgiving";

  // Christmas: Dec 1 – 26.
  if (inRange(1201, 1226))
    return "christmas";

  // Winter as a gentle off-holiday seasonal default: Jan 3 – Feb 6.
  if (inRange(103, 206))
    return "winter";

  return null;
}
