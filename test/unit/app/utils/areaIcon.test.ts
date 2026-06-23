import { describe, expect, it } from "vitest";

import { areaIconFor, AREA_ICON_FALLBACK, resolveAreaIcon } from "../../../../app/utils/areaIcon";

describe("areaIconFor", () => {
  it.each([
    ["Kitchen", "i-lucide-utensils"],
    ["Bathroom", "i-lucide-bath"],
    ["Laundry", "i-lucide-washing-machine"],
    ["Yard", "i-lucide-trees"],
    ["Bedroom", "i-lucide-bed-double"],
    ["Living Room", "i-lucide-sofa"],
    ["Garage", "i-lucide-car"],
    ["Trash", "i-lucide-trash-2"],
  ])("maps %s → %s", (name, icon) => {
    expect(areaIconFor(name)).toBe(icon);
  });

  it("is case-insensitive and matches substrings", () => {
    expect(areaIconFor("KITCHEN cleanup")).toBe("i-lucide-utensils");
    expect(areaIconFor("kids bedroom")).toBe("i-lucide-bed-double");
  });

  it("falls back to a folder for unknown or empty names", () => {
    expect(areaIconFor("Zorblax")).toBe(AREA_ICON_FALLBACK);
    expect(areaIconFor("")).toBe(AREA_ICON_FALLBACK);
    expect(areaIconFor(null)).toBe(AREA_ICON_FALLBACK);
    expect(areaIconFor(undefined)).toBe(AREA_ICON_FALLBACK);
  });

  it("does not match 'washroom' as laundry (bath wins)", () => {
    expect(areaIconFor("Washroom")).toBe("i-lucide-bath");
  });
});

describe("resolveAreaIcon", () => {
  it("prefers an explicit Lucide icon", () => {
    expect(resolveAreaIcon({ icon: "i-lucide-star", name: "Kitchen" })).toBe("i-lucide-star");
  });

  it("returns an explicit emoji as-is", () => {
    expect(resolveAreaIcon({ icon: "🧼", name: "Kitchen" })).toBe("🧼");
  });

  it("falls back to a name-derived icon when no explicit icon is set", () => {
    expect(resolveAreaIcon({ icon: null, name: "Bathroom" })).toBe("i-lucide-bath");
    expect(resolveAreaIcon({ icon: "  ", name: "Laundry" })).toBe("i-lucide-washing-machine");
  });
});
