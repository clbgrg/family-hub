<script setup lang="ts">
import { MAIN_VIEW_OPTIONS } from "~/types/ui";

// Auth is enforced globally by app/middleware/auth.global.ts (client) and
// server/middleware/auth.ts (API). This page just routes to the user's view.
const { preferences } = useClientPreferences();
const allowedPaths = MAIN_VIEW_OPTIONS.map(o => o.path);
const target = preferences.value?.defaultView ?? "/calendar";
const resolved = allowedPaths.includes(target) ? target : "/calendar";
if (import.meta.client) {
  await navigateTo(resolved);
}
</script>

<template>
  <div>
    <p>Redirecting...</p>
  </div>
</template>
