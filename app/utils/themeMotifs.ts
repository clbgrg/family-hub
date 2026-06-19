import type { ThemeName } from "~/types/ui";

export type ThemeMotif = {
  // Emoji used for the ambient decor overlay + the switch-celebration confetti.
  emojis: string[];
  // Confetti burst colors when this theme is switched on.
  colors: string[];
  // How the ambient particles move across the screen.
  motion: "fall" | "rise" | "float" | "twinkle";
};

/**
 * Per-theme decorative motif. Themes not listed (default, minecraft) get no
 * ambient decor and no switch burst. Emoji are used directly (offline-safe — no
 * icon/CDN dependency).
 */
export const THEME_MOTIFS: Partial<Record<ThemeName, ThemeMotif>> = {
  birthday: { emojis: ["🎈", "🎉", "🎂", "🥳"], colors: ["#ec4899", "#f59e0b", "#22c55e", "#3b82f6"], motion: "rise" },
  valentines: { emojis: ["❤️", "💕", "💝", "🌹"], colors: ["#e11d48", "#f472a6", "#fda4c4"], motion: "float" },
  stpatricks: { emojis: ["☘️", "🍀", "🌈", "🪙"], colors: ["#15803d", "#4ade80", "#d4af37"], motion: "fall" },
  easter: { emojis: ["🐰", "🥚", "🌷", "🐣"], colors: ["#9333ea", "#f0abfc", "#a7f3d0", "#fde68a"], motion: "float" },
  independence: { emojis: ["🎆", "🎇", "⭐", "🎉"], colors: ["#b91c1c", "#1e3a8a", "#ffffff"], motion: "rise" },
  halloween: { emojis: ["🎃", "👻", "🦇", "🕸️"], colors: ["#f97316", "#7c3aed", "#22c55e"], motion: "float" },
  thanksgiving: { emojis: ["🍁", "🍂", "🦃", "🌽"], colors: ["#c2410c", "#b45309", "#d8a26a"], motion: "fall" },
  christmas: { emojis: ["🎄", "🎁", "❄️", "⛄"], colors: ["#c1121f", "#1b5e3a", "#d4af37"], motion: "fall" },
  newyears: { emojis: ["🎉", "🥂", "✨", "🎊"], colors: ["#d4af37", "#ffffff", "#a855f7"], motion: "rise" },
  winter: { emojis: ["❄️", "⛄", "🌨️", "🧣"], colors: ["#0284c7", "#7dd3fc", "#ffffff"], motion: "fall" },
  space: { emojis: ["🪐", "⭐", "🚀", "🌙", "✨"], colors: ["#8b5cf6", "#22d3ee", "#ffffff"], motion: "twinkle" },
};

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * A short, themed confetti burst when a theme is actively switched on. Lazy-loads
 * canvas-confetti (already a dependency) and uses emoji shapes. No-op for themes
 * without a motif, on the server, or under reduced-motion.
 */
export async function celebrateTheme(theme: ThemeName): Promise<void> {
  if (import.meta.server)
    return;
  const motif = THEME_MOTIFS[theme];
  if (!motif || prefersReducedMotion())
    return;
  try {
    const confetti = (await import("canvas-confetti")).default;
    const shapes = motif.emojis.slice(0, 3).map(text => confetti.shapeFromText({ text, scalar: 2 }));
    confetti({ particleCount: 50, spread: 80, origin: { y: 0.35 }, shapes, scalar: 2, colors: motif.colors });
    confetti({ particleCount: 40, spread: 100, startVelocity: 35, origin: { y: 0.45 }, colors: motif.colors });
  }
  catch {
    // canvas-confetti is best-effort flair; never let it break theming.
  }
}
