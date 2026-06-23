<script setup lang="ts">
const route = useRoute();
function isActivePath(path: string) {
  return route.path === path;
}

// iMessage-style unread badge on the Family Board tab. Refreshed on every
// navigation plus a slow poll, so notes posted from another device show up
// on the kiosk without a reload.
const { count: unreadNotes, refresh: refreshUnread } = useUnreadMessages();
watch(() => route.path, () => refreshUnread());
let unreadTimer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  unreadTimer = setInterval(refreshUnread, 60_000);
});
onBeforeUnmount(() => {
  if (unreadTimer)
    clearInterval(unreadTimer);
});
</script>

<template>
  <div
    class="sticky top-0 left-0 h-[calc(100vh-80px)] w-[50px] bg-default flex flex-col items-center justify-evenly py-4 z-100"
  >
    <UButton
      :class="isActivePath('/') ? 'text-primary' : 'text-default'"
      to="/"
      variant="ghost"
      icon="i-lucide-home"
      size="xl"
      aria-label="Dashboard"
    />
    <UButton
      :class="isActivePath('/calendar') ? 'text-primary' : 'text-default'"
      to="/calendar"
      variant="ghost"
      icon="i-lucide-calendar-days"
      size="xl"
      aria-label="Calendar"
    />
    <UButton
      :class="isActivePath('/toDoLists') ? 'text-primary' : 'text-default'"
      to="/toDoLists"
      variant="ghost"
      icon="i-lucide-list-todo"
      size="xl"
      aria-label="Todo Lists"
    />
    <UButton
      :class="isActivePath('/school') ? 'text-primary' : 'text-default'"
      to="/school"
      variant="ghost"
      icon="i-lucide-graduation-cap"
      size="xl"
      aria-label="School"
    />
    <UButton
      :class="isActivePath('/chores') ? 'text-primary' : 'text-default'"
      to="/chores"
      variant="ghost"
      icon="i-lucide-list-checks"
      size="xl"
      aria-label="Chores"
    />
    <UButton
      :class="isActivePath('/rewards') ? 'text-primary' : 'text-default'"
      to="/rewards"
      variant="ghost"
      icon="i-lucide-gift"
      size="xl"
      aria-label="Rewards"
    />
    <div class="relative">
      <UButton
        :class="isActivePath('/messages') ? 'text-primary' : 'text-default'"
        to="/messages"
        variant="ghost"
        icon="i-lucide-sticky-note"
        size="xl"
        aria-label="Family Board"
      />
      <ClientOnly>
        <span
          v-if="unreadNotes > 0"
          class="pointer-events-none absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold text-white"
        >
          {{ unreadNotes > 9 ? "9+" : unreadNotes }}
        </span>
      </ClientOnly>
    </div>
    <GlobalAlertsBell />
    <UButton
      :class="isActivePath('/shoppingLists') ? 'text-primary' : 'text-default'"
      to="/shoppingLists"
      variant="ghost"
      icon="i-lucide-shopping-cart"
      size="xl"
      aria-label="Shopping Lists"
    />
    <UButton
      :class="isActivePath('/mealPlanner') ? 'text-primary' : 'text-default'"
      to="/mealPlanner"
      variant="ghost"
      icon="i-lucide-utensils"
      size="xl"
      aria-label="Meal Planner"
    />
    <UButton
      :class="isActivePath('/documents') ? 'text-primary' : 'text-default'"
      to="/documents"
      variant="ghost"
      icon="i-lucide-folder"
      size="xl"
      aria-label="Documents"
    />
    <UButton
      :class="isActivePath('/stats') ? 'text-primary' : 'text-default'"
      to="/stats"
      variant="ghost"
      icon="i-lucide-chart-column"
      size="xl"
      aria-label="Stats"
    />
    <UButton
      :class="isActivePath('/history') ? 'text-primary' : 'text-default'"
      to="/history"
      variant="ghost"
      icon="i-lucide-history"
      size="xl"
      aria-label="History"
    />
    <UButton
      :class="isActivePath('/settings') ? 'text-primary' : 'text-default'"
      to="/settings"
      variant="ghost"
      icon="i-lucide-settings"
      size="xl"
      aria-label="Settings"
    />
  </div>
</template>
