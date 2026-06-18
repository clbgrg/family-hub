import { describe, expect, it } from "vitest";

import type { AreaInfo } from "~/composables/useChores";
import { groupChoresByArea, recurrenceLabel } from "~/composables/useChores";

const kitchen: AreaInfo = { id: "k", name: "Kitchen", icon: "🧼", order: 0 };
const bedroom: AreaInfo = { id: "b", name: "Bedroom", icon: "🛏️", order: 1 };

function row(id: string, area: AreaInfo | null) {
  return { id, area };
}

describe("recurrenceLabel", () => {
  it("maps each recurrence to a short tag", () => {
    expect(recurrenceLabel({ recurrence: "DAILY" })).toBe("Daily");
    expect(recurrenceLabel({ recurrence: "WEEKLY" })).toBe("Weekly");
    expect(recurrenceLabel({ recurrence: "ONCE" })).toBe("One-time");
  });
});

describe("groupChoresByArea", () => {
  it("returns an empty array for no chores", () => {
    expect(groupChoresByArea([])).toEqual([]);
  });

  it("groups chores under their area", () => {
    const groups = groupChoresByArea([row("1", kitchen), row("2", kitchen)]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.area).toEqual(kitchen);
    expect(groups[0]!.chores.map(c => c.id)).toEqual(["1", "2"]);
  });

  it("orders groups by area.order and puts un-areaed chores last as 'Other'", () => {
    const groups = groupChoresByArea([
      row("1", bedroom), // order 1
      row("2", null), // no area → Other
      row("3", kitchen), // order 0
    ]);
    expect(groups.map(g => g.area?.name ?? "Other")).toEqual(["Kitchen", "Bedroom", "Other"]);
    expect(groups.at(-1)!.area).toBeNull();
  });

  it("preserves chore order within a group", () => {
    const groups = groupChoresByArea([row("a", kitchen), row("b", kitchen), row("c", kitchen)]);
    expect(groups[0]!.chores.map(c => c.id)).toEqual(["a", "b", "c"]);
  });
});
