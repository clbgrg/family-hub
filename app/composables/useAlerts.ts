export type Alert = {
  id: string;
  type: string;
  icon: string;
  title: string;
  body?: string;
  at: string;
};

/**
 * In-app alerts for the session user (event reminders + reward approvals),
 * gated by the per-device `notifications` preference. Shared asyncData key so
 * the bell badge and panel stay in sync; fetched client-only and polled.
 */
export function useAlerts() {
  const requestFetch = useRequestFetch();
  const { loggedIn } = useUserSession();
  const { preferences } = useClientPreferences();
  const enabled = computed(() => preferences.value?.notifications ?? false);

  const { data, refresh } = useAsyncData(
    "alerts",
    () => (loggedIn.value && enabled.value)
      ? requestFetch<{ alerts: Alert[] }>("/api/alerts")
      : Promise.resolve({ alerts: [] }),
    { default: () => ({ alerts: [] }), server: false, watch: [enabled] },
  );

  const alerts = computed(() => data.value?.alerts ?? []);
  const count = computed(() => alerts.value.length);

  return { alerts, count, enabled, refresh };
}
