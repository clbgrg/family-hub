import { describe, expect, it } from "vitest";

import { normalizeWeekdays } from "../../../../server/utils/weekdays";

describe("normalizeWeekdays", () => {
  it("returns [] for non-arrays", () => {
    expect(normalizeWeekdays(undefined)).toEqual([]);
    expect(normalizeWeekdays(null)).toEqual([]);
    expect(normalizeWeekdays("1,2")).toEqual([]);
  });

  it("dedupes, sorts, and drops out-of-range / non-integer values", () => {
    expect(normalizeWeekdays([3, 1, 1, 9, -1, 2.5, 6])).toEqual([1, 3, 6]);
  });

  it("accepts the full valid range 0..6", () => {
    expect(normalizeWeekdays([6, 5, 4, 3, 2, 1, 0])).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("coerces numeric strings", () => {
    expect(normalizeWeekdays(["1", "3"])).toEqual([1, 3]);
  });
});
