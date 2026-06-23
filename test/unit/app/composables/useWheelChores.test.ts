import { describe, expect, it } from "vitest";

import { DEFAULT_WHEEL_CHORES, parseWheelChores } from "../../../../app/composables/useWheelChores";

describe("parseWheelChores", () => {
  it("falls back to defaults when unset", () => {
    expect(parseWheelChores(undefined)).toEqual(DEFAULT_WHEEL_CHORES);
    expect(parseWheelChores(null)).toEqual(DEFAULT_WHEEL_CHORES);
    expect(parseWheelChores("")).toEqual(DEFAULT_WHEEL_CHORES);
  });

  it("parses a stored JSON array", () => {
    expect(parseWheelChores('["Mop","Dust"]')).toEqual(["Mop", "Dust"]);
  });

  it("keeps an explicit empty list (the user cleared the wheel)", () => {
    expect(parseWheelChores("[]")).toEqual([]);
  });

  it("filters non-strings and survives bad JSON", () => {
    expect(parseWheelChores('["A",1,null,"B"]')).toEqual(["A", "B"]);
    expect(parseWheelChores("not json")).toEqual(DEFAULT_WHEEL_CHORES);
  });
});
