// Code-defined badge types. Conditions are checked against a user's stats on
// each chore completion; earned badges are recorded in UserBadge (permanent).
// Deferred (need time-of-day / all-due history / leaderboard period):
// Speed Demon, Perfect Week, Champion.

export interface BadgeStats {
  totalCompletions: number;
  maxPointsInADay: number;
  streak: number;
}

export interface BadgeDef {
  key: string;
  label: string;
  icon: string; // lucide icon name
  description: string;
  earned: (s: BadgeStats) => boolean;
}

export const BADGES: BadgeDef[] = [
  {
    key: "FIRST_CHORE",
    label: "First Chore",
    icon: "i-lucide-sparkles",
    description: "Completed your first chore",
    earned: s => s.totalCompletions >= 1,
  },
  {
    key: "CLEAN_MACHINE",
    label: "Clean Machine",
    icon: "i-lucide-award",
    description: "Completed 30 chores",
    earned: s => s.totalCompletions >= 30,
  },
  {
    key: "ALL_STAR",
    label: "All-Star",
    icon: "i-lucide-star",
    description: "Earned 100+ points in one day",
    earned: s => s.maxPointsInADay >= 100,
  },
  {
    key: "HOT_STREAK",
    label: "Hot Streak",
    icon: "i-lucide-flame",
    description: "7-day chore streak",
    earned: s => s.streak >= 7,
  },
];

const BADGE_BY_KEY = new Map(BADGES.map(b => [b.key, b]));

export function badgeByKey(key: string): BadgeDef | undefined {
  return BADGE_BY_KEY.get(key);
}

export function computeEarnedBadgeKeys(stats: BadgeStats): string[] {
  return BADGES.filter(b => b.earned(stats)).map(b => b.key);
}
