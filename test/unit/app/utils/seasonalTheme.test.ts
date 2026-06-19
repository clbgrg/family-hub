import { describe, expect, it } from "vitest";

import { computus, seasonalThemeFor } from "../../../../app/utils/seasonalTheme";

describe("computus (Easter Sunday)", () => {
  it.each([
    [2024, 3, 31],
    [2025, 4, 20],
    [2026, 4, 5],
    [2027, 3, 28],
  ])("year %i → Easter %i/%i", (year, month, day) => {
    expect(computus(year)).toEqual({ month, day });
  });
});

describe("seasonalThemeFor", () => {
  const on = (y: number, m: number, d: number) => seasonalThemeFor(new Date(y, m - 1, d));

  it("maps fixed-date holiday windows", () => {
    expect(on(2026, 1, 1)).toBe("newyears");
    expect(on(2026, 12, 31)).toBe("newyears");
    expect(on(2026, 2, 10)).toBe("valentines");
    expect(on(2026, 3, 16)).toBe("stpatricks");
    expect(on(2026, 7, 4)).toBe("independence");
    expect(on(2026, 10, 28)).toBe("halloween");
    expect(on(2026, 12, 25)).toBe("christmas");
  });

  it("maps Easter week (2026 Easter = Apr 5)", () => {
    expect(on(2026, 4, 5)).toBe("easter");
    expect(on(2026, 3, 30)).toBe("easter"); // within the 6 days before
  });

  it("maps US Thanksgiving week (2026 = Nov 26)", () => {
    expect(on(2026, 11, 26)).toBe("thanksgiving");
    expect(on(2026, 11, 23)).toBe("thanksgiving");
  });

  it("uses winter as a deep-January fallback and null off-season", () => {
    expect(on(2026, 1, 20)).toBe("winter");
    expect(on(2026, 6, 15)).toBeNull();
    expect(on(2026, 9, 1)).toBeNull();
  });
});
