import type { CalendarView } from "~/types/calendar";
import type { ShoppingList, TodoList } from "~/types/database";

export type ConnectionTestResult = {
  success: boolean;
  message?: string;
  error?: string;
  isLoading?: boolean;
} | null;

export type ShoppingListWithIntegration = ShoppingList & {
  source: "native" | "integration";
  integrationId?: string;
  integrationName?: string;
  integrationIcon?: string | null;
};

export type TodoListWithIntegration = TodoList & {
  source: "native" | "integration";
  integrationId?: string;
  integrationName?: string;
  integrationIcon?: string | null;
};

export type AnyListWithIntegration
  = | ShoppingListWithIntegration
    | TodoListWithIntegration;

export type ToggleEvent = {
  itemId: string;
  checked: boolean;
};

export type ReorderEvent = {
  itemId: string;
  newOrder: number;
  direction?: "up" | "down";
};

export type ReorderDirectionEvent = {
  itemId: string;
  direction: "up" | "down";
};

export type DialogField = {
  key: string;
  label: string;
  type: "text" | "number" | "textarea";
  placeholder?: string;
  min?: number;
  required?: boolean;
  disabled?: boolean;
  canEdit: boolean;
};

export type IntegrationSettingsField = {
  key: string;
  label: string;
  type: "text" | "password" | "url" | "color" | "boolean";
  placeholder?: string;
  required?: boolean;
  description?: string;
};

export type ToastType = "error" | "warning" | "success" | "info";

export type GlobalFloatingActionButtonProps = {
  icon?: string;
  label?: string;
  color?: "primary" | "secondary" | "success" | "warning" | "error";
  size?: "sm" | "md" | "lg";
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  disabled?: boolean;
};

const SYSTEM_FONT_STACK = "ui-sans-serif, system-ui, sans-serif, \"Noto Color Emoji\"";

const FONT_PREFERENCES = [
  { value: "system", label: "System", stack: SYSTEM_FONT_STACK },
  {
    value: "inclusiveSans",
    label: "Inclusive Sans",
    stack: `"Inclusive Sans", ${SYSTEM_FONT_STACK}`,
  },
  {
    value: "notoSans",
    label: "Noto Sans",
    stack: `"Noto Sans", ${SYSTEM_FONT_STACK}`,
  },
  {
    value: "ebGaramond",
    label: "EB Garamond",
    stack: `"EB Garamond", ${SYSTEM_FONT_STACK}`,
  },
  {
    value: "ibmPlexMono",
    label: "IBM Plex Mono",
    stack: `"IBM Plex Mono", ${SYSTEM_FONT_STACK}`,
  },
  {
    value: "ovo",
    label: "Ovo",
    stack: `"Ovo", ${SYSTEM_FONT_STACK}`,
  },
  {
    value: "handlee",
    label: "Handlee",
    stack: `"Handlee", ${SYSTEM_FONT_STACK}`,
  },
] as const;

export type FontPreference = (typeof FONT_PREFERENCES)[number]["value"];

export type TodoSortMode = "date" | "priority" | "alpha";

// Site-wide visual theme (per-device). Applied as `data-theme` on <html>;
// "default" removes the attribute and uses the standard light/dark tokens.
export type ThemeName
  = | "default"
    | "auto"
    | "birthday"
    | "valentines"
    | "stpatricks"
    | "easter"
    | "independence"
    | "halloween"
    | "thanksgiving"
    | "christmas"
    | "newyears"
    | "winter"
    | "space"
    | "nature"
    | "ocean"
    | "adventure"
    | "fantasy"
    | "minecraft";

// Lucide icons (not emoji) so theme labels render on every device, incl. the
// Pi kiosk that has no color-emoji font.
export const THEME_OPTIONS: { value: ThemeName; label: string; icon: string }[] = [
  { value: "default", label: "Default", icon: "i-lucide-palette" },
  { value: "auto", label: "Auto (Seasonal)", icon: "i-lucide-sparkles" },
  // Holidays, roughly in calendar order…
  { value: "birthday", label: "Birthday", icon: "i-lucide-party-popper" },
  { value: "valentines", label: "Valentine's", icon: "i-lucide-heart" },
  { value: "stpatricks", label: "St. Patrick's", icon: "i-lucide-clover" },
  { value: "easter", label: "Easter", icon: "i-lucide-egg" },
  { value: "independence", label: "Independence", icon: "i-lucide-flag" },
  { value: "halloween", label: "Halloween", icon: "i-lucide-ghost" },
  { value: "thanksgiving", label: "Thanksgiving", icon: "i-lucide-drumstick" },
  { value: "christmas", label: "Christmas", icon: "i-lucide-tree-pine" },
  { value: "newyears", label: "New Year's", icon: "i-lucide-party-popper" },
  // …seasons + fun.
  { value: "winter", label: "Winter", icon: "i-lucide-snowflake" },
  { value: "space", label: "Space", icon: "i-lucide-rocket" },
  { value: "nature", label: "Nature", icon: "i-lucide-trees" },
  { value: "ocean", label: "Ocean", icon: "i-lucide-waves" },
  { value: "adventure", label: "Adventure", icon: "i-lucide-mountain" },
  { value: "fantasy", label: "Fantasy", icon: "i-lucide-wand-sparkles" },
  { value: "minecraft", label: "Minecraft", icon: "i-lucide-pickaxe" },
];

export type ClientPreferences = {
  colorMode?: "light" | "dark" | "system";
  notifications?: boolean;
  font?: FontPreference;
  todoSortBy?: TodoSortMode;
  defaultView?: string;
  calendarView?: CalendarView;
  // Screensaver is a property of this physical display, so it lives in
  // per-device client preferences (not a shared server setting).
  screensaverEnabled?: boolean;
  screensaverIdleMinutes?: number;
  // School page: hide the parents' (admin) rows/columns — kids are the students.
  schoolStudentsOnly?: boolean;
  // Site-wide visual theme for this device.
  theme?: ThemeName;
  // Ambient per-theme decorations (snow, balloons, …) on this device. On by default.
  themeDecorEnabled?: boolean;
};

export const MAIN_VIEW_OPTIONS: { path: string; label: string }[] = [
  { path: "/calendar", label: "Calendar" },
  { path: "/toDoLists", label: "Todo Lists" },
  { path: "/shoppingLists", label: "Shopping Lists" },
  { path: "/mealPlanner", label: "Meal Planner" },
];

export const defaultClientPreferences: ClientPreferences = {
  colorMode: "system",
  notifications: false,
  font: "system",
  todoSortBy: "date",
  defaultView: "/calendar",
  calendarView: "week",
  screensaverEnabled: true,
  screensaverIdleMinutes: 5,
  schoolStudentsOnly: true,
  theme: "default",
  themeDecorEnabled: true,
};

export const TODO_SORT_OPTIONS: { value: TodoSortMode; label: string }[] = [
  { value: "date", label: "Date" },
  { value: "priority", label: "Priority" },
  { value: "alpha", label: "A-Z" },
];

export const FONT_STACKS: Record<FontPreference, string> = Object.fromEntries(
  FONT_PREFERENCES.map(f => [f.value, f.stack]),
) as Record<FontPreference, string>;

export const FONT_OPTIONS: { label: string; value: FontPreference }[]
  = FONT_PREFERENCES.map(({ value, label }) => ({ value, label }));

export function getFontStack(font: FontPreference | undefined): string {
  if (!font || font === "system")
    return SYSTEM_FONT_STACK;
  return FONT_STACKS[font] ?? SYSTEM_FONT_STACK;
}
