/**
 * Normalize arbitrary input into a sorted, de-duped array of valid weekday
 * indices (0 = Sun … 6 = Sat). Anything out of range or non-integer is dropped.
 * Used for SavedMeal.defaultDays (and mirrors Chore.daysOfWeek semantics).
 */
export function normalizeWeekdays(input: unknown): number[] {
  if (!Array.isArray(input))
    return [];
  const days = input
    .map(Number)
    .filter(n => Number.isInteger(n) && n >= 0 && n <= 6);
  return [...new Set(days)].sort((a, b) => a - b);
}
