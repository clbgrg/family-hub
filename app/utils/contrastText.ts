/**
 * A readable text color (dark or light) for a given hex background, using the
 * standard perceived-luminance formula (same as settingsUserDialog/useCalendar).
 */
export function contrastText(hex: string | null | undefined): string {
  if (!hex) return "#111827";
  const h = hex.replace("#", "");
  if (h.length < 6) return "#111827";
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#111827" : "#ffffff";
}
