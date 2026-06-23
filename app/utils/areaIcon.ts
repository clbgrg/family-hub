// Map a chore-area NAME to a sensible Lucide icon, so areas without an explicit
// icon still show a meaningful graphic instead of the generic folder. Used as
// the render fallback on the dashboard / chores board / settings, and as the
// live suggestion in the area dialog. Matching is case-insensitive + substring;
// earlier rules win. All icons are verified present in @iconify-json/lucide and
// resolve offline via the same-origin /api/_nuxt_icon route (serverBundle local).

export const AREA_ICON_FALLBACK = "i-lucide-folder";

const AREA_ICON_RULES: { match: RegExp; icon: string }[] = [
  { match: /kitchen|cook|dish|meal|food|pantry/, icon: "i-lucide-utensils" },
  { match: /bath|shower|toilet|restroom|washroom|powder room/, icon: "i-lucide-bath" },
  { match: /laundry|washing|dryer|linen/, icon: "i-lucide-washing-machine" },
  { match: /yard|garden|lawn|outdoor|outside|patio|deck/, icon: "i-lucide-trees" },
  { match: /bedroom|bed\b/, icon: "i-lucide-bed-double" },
  { match: /living|lounge|family room|den|sitting/, icon: "i-lucide-sofa" },
  { match: /garage|driveway|\bcar\b/, icon: "i-lucide-car" },
  { match: /trash|garbage|rubbish|recycl|waste|dustbin/, icon: "i-lucide-trash-2" },
  { match: /pet|\bdog\b|\bcat\b|animal|aquarium|fish tank/, icon: "i-lucide-paw-print" },
  { match: /clean|tidy|dust|vacuum|sweep|\bmop\b/, icon: "i-lucide-spray-can" },
  { match: /school|homework|study|class|reading/, icon: "i-lucide-graduation-cap" },
  { match: /office|desk|\bwork\b|computer/, icon: "i-lucide-briefcase" },
  { match: /play|game|toy/, icon: "i-lucide-gamepad-2" },
  { match: /baby|nursery|infant/, icon: "i-lucide-baby" },
  { match: /fridge|refrigerat|freezer/, icon: "i-lucide-refrigerator" },
  { match: /fix|repair|tool|maintenance|workshop/, icon: "i-lucide-wrench" },
  { match: /plant|flower|water/, icon: "i-lucide-flower-2" },
  { match: /gym|exercise|workout|fitness/, icon: "i-lucide-dumbbell" },
  { match: /closet|wardrobe|storage|attic|basement/, icon: "i-lucide-warehouse" },
  { match: /door|entry|hallway|entrance|foyer|mudroom/, icon: "i-lucide-door-open" },
];

/**
 * Best-guess Lucide icon name (`i-lucide-*`) for a chore-area name. Returns
 * {@link AREA_ICON_FALLBACK} when nothing matches or the name is empty.
 */
export function areaIconFor(name: string | null | undefined): string {
  const n = (name ?? "").toLowerCase().trim();
  if (!n)
    return AREA_ICON_FALLBACK;
  for (const rule of AREA_ICON_RULES) {
    if (rule.match.test(n))
      return rule.icon;
  }
  return AREA_ICON_FALLBACK;
}

/**
 * The icon to render for an area: an explicit emoji or `i-lucide-*` the user
 * set wins; otherwise fall back to a name-derived Lucide icon. Emoji are
 * returned as-is (callers render them as text, not via UIcon).
 */
export function resolveAreaIcon(area: { icon?: string | null; name?: string | null }): string {
  const explicit = area.icon?.trim();
  if (explicit)
    return explicit;
  return areaIconFor(area.name);
}
