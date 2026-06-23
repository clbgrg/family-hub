import { describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import { loadThemeBgMap } from "~~/server/utils/themeBackgrounds";

vi.mock("~/lib/prisma");

describe("loadThemeBgMap", () => {
  it("returns an empty map when the setting is unset", async () => {
    prisma.setting.findUnique.mockResolvedValue(null);
    expect(await loadThemeBgMap()).toEqual({});
  });

  it("parses the stored per-theme map", async () => {
    prisma.setting.findUnique.mockResolvedValue({
      key: "themeBackgrounds",
      value: JSON.stringify({
        space: { storedName: "themebg-1.webp", name: "n", type: "image/webp", brightness: 1, blur: 0 },
      }),
    });
    const map = await loadThemeBgMap();
    expect(map.space?.storedName).toBe("themebg-1.webp");
  });

  it("returns an empty map on malformed JSON", async () => {
    prisma.setting.findUnique.mockResolvedValue({ key: "themeBackgrounds", value: "not json" });
    expect(await loadThemeBgMap()).toEqual({});
  });
});
