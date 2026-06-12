/**
 * Unread family-board note count for the session user (shared asyncData key,
 * so the sidebar badge, dashboard banner, and board page all stay in sync).
 */
export function useUnreadMessages() {
  const requestFetch = useRequestFetch();
  const { loggedIn } = useUserSession();

  const { data, refresh } = useAsyncData(
    "unread-messages",
    () =>
      loggedIn.value
        ? requestFetch<{ count: number }>("/api/messages/unread-count")
        : Promise.resolve({ count: 0 }),
    { default: () => ({ count: 0 }), server: false },
  );

  const count = computed(() => data.value?.count ?? 0);

  async function markRead() {
    if (!loggedIn.value)
      return;
    await $fetch("/api/messages/read", { method: "POST" });
    await refresh();
  }

  return { count, refresh, markRead };
}
