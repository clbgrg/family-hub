import prisma from "~/lib/prisma";

// Per-theme custom background images. The file bytes live on the files volume
// (via fileStore); this metadata map is shared family-wide in the
// `themeBackgrounds` Setting (JSON: theme name → entry).
export type ThemeBgEntry = {
  storedName: string;
  name: string;
  type: string;
  brightness: number; // CSS brightness() factor, ~0.3–1.5 (1 = unchanged)
  blur: number; // CSS blur() px, 0–12
};

export async function loadThemeBgMap(): Promise<Record<string, ThemeBgEntry>> {
  const row = await prisma.setting.findUnique({ where: { key: "themeBackgrounds" } });
  if (!row?.value)
    return {};
  try {
    const m = JSON.parse(row.value);
    return m && typeof m === "object" ? (m as Record<string, ThemeBgEntry>) : {};
  }
  catch {
    return {};
  }
}

export async function saveThemeBgMap(map: Record<string, ThemeBgEntry>): Promise<void> {
  const value = JSON.stringify(map);
  await prisma.setting.upsert({
    where: { key: "themeBackgrounds" },
    create: { key: "themeBackgrounds", value },
    update: { value },
  });
}
