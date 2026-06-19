<script setup lang="ts">
// Rendered inside the settings parent-unlock section; gate() covers the
// elevation window expiring mid-edit.
const { gate } = useAdminGate();
const { pointsLabel, gradeScale, config, save } = useFamilyConfig();

const labelInput = ref("");
const gradeInput = ref("");
const boostEnabled = ref(false);
const seasonalEnabled = ref(false);
const saved = ref(false);

// Seed inputs from the saved config. Only the initial load and a post-save
// refresh change `config`, so re-seeding is harmless (inputs already match).
watchEffect(() => {
  labelInput.value = config.value.pointsLabel ?? "";
  gradeInput.value = config.value.gradeScale ?? "";
  boostEnabled.value = config.value.autoBoostEnabled === "true";
  seasonalEnabled.value = config.value.autoSeasonalTheme === "true";
});

async function onSave() {
  await gate(() => save({
    pointsLabel: labelInput.value.trim(),
    gradeScale: gradeInput.value.trim(),
    autoBoostEnabled: boostEnabled.value ? "true" : "false",
    autoSeasonalTheme: seasonalEnabled.value ? "true" : "false",
  }));
  saved.value = true;
  setTimeout(() => {
    saved.value = false;
  }, 2000);
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="space-y-2">
      <label class="block text-sm font-medium text-highlighted">Points label</label>
      <UInput
        v-model="labelInput"
        placeholder="points (e.g. Stars, Bucks)"
        class="w-full"
        :ui="{ base: 'w-full' }"
      />
      <p class="text-xs text-muted">
        What to call points across the app — currently <span class="font-medium">{{ pointsLabel }}</span>.
      </p>
    </div>

    <div class="space-y-2">
      <label class="block text-sm font-medium text-highlighted">Grade scale</label>
      <UInput
        v-model="gradeInput"
        placeholder="A,B,C,D,F"
        class="w-full"
        :ui="{ base: 'w-full' }"
      />
      <p class="text-xs text-muted">
        Comma-separated grades offered on school items. Leave blank for free-text.<template v-if="gradeScale.length">
          ({{ gradeScale.length }} grades)
        </template>
      </p>
    </div>

    <div class="space-y-2">
      <label class="block text-sm font-medium text-highlighted">Automatic point-boosting</label>
      <UCheckbox v-model="boostEnabled" label="Boost neglected chores automatically" />
      <p class="text-xs text-muted">
        When a recurring chore keeps getting skipped, its {{ pointsLabel }} climb a little each missed day (up to a cap) until someone does it — then it resets. Off by default.
      </p>
    </div>

    <div class="space-y-2">
      <label class="block text-sm font-medium text-highlighted">Auto-seasonal themes</label>
      <UCheckbox v-model="seasonalEnabled" label="Match the theme to the season automatically" />
      <p class="text-xs text-muted">
        When on, devices left on the <span class="font-medium">Default</span> theme automatically switch to the matching holiday skin around its date — Halloween in late October, Christmas in December, and so on. Anyone can still pick a specific theme on their own device to override it. Off by default.
      </p>
    </div>

    <div class="flex items-center gap-3">
      <UButton color="primary" @click="onSave">
        Save
      </UButton>
      <span v-if="saved" class="text-sm text-muted">Saved ✓</span>
    </div>
  </div>
</template>
