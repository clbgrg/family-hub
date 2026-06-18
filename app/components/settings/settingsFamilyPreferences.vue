<script setup lang="ts">
// Rendered inside the settings parent-unlock section; gate() covers the
// elevation window expiring mid-edit.
const { gate } = useAdminGate();
const { pointsLabel, gradeScale, config, save } = useFamilyConfig();

const labelInput = ref("");
const gradeInput = ref("");
const saved = ref(false);

// Seed inputs from the saved config. Only the initial load and a post-save
// refresh change `config`, so re-seeding is harmless (inputs already match).
watchEffect(() => {
  labelInput.value = config.value.pointsLabel ?? "";
  gradeInput.value = config.value.gradeScale ?? "";
});

async function onSave() {
  await gate(() => save({ pointsLabel: labelInput.value.trim(), gradeScale: gradeInput.value.trim() }));
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

    <div class="flex items-center gap-3">
      <UButton color="primary" @click="onSave">
        Save
      </UButton>
      <span v-if="saved" class="text-sm text-muted">Saved ✓</span>
    </div>
  </div>
</template>
