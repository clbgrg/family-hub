/**
 * "Parent unlock" for the shared kiosk: the device stays signed in as an
 * ADMIN, so management actions re-confirm a parent PIN (POST /api/auth/elevate,
 * ~5 min validity). Server-side, mutation endpoints enforce this via
 * requireElevatedAdmin; this composable is the client half — a shared PIN
 * modal plus a gate() wrapper that elevates before running an action and
 * retries once if the server reports ELEVATION_REQUIRED mid-action.
 */

type PendingPrompt = {
  resolve: (ok: boolean) => void;
};

export function useAdminGate() {
  const { session, fetch: refreshSession, user } = useUserSession();

  // Ticking clock so isUnlocked flips reactively when the window expires.
  const now = useState("admin-gate-now", () => Date.now());
  if (import.meta.client) {
    const ticking = useState("admin-gate-ticking", () => false);
    if (!ticking.value) {
      ticking.value = true;
      setInterval(() => {
        now.value = Date.now();
      }, 1000);
    }
  }

  const elevatedUntil = computed(() => session.value?.elevatedUntil ?? 0);
  const isAdmin = computed(() => user.value?.role === "ADMIN");
  const isUnlocked = computed(
    () => isAdmin.value && elevatedUntil.value > now.value,
  );
  const secondsLeft = computed(() =>
    Math.max(0, Math.ceil((elevatedUntil.value - now.value) / 1000)),
  );

  // Shared modal state — a single adminGateModal instance lives in app.vue.
  const promptOpen = useState("admin-gate-open", () => false);
  const pending = useState<PendingPrompt | null>("admin-gate-pending", () => null);

  function ensureElevated(): Promise<boolean> {
    if (!isAdmin.value)
      return Promise.resolve(false);
    if (isUnlocked.value)
      return Promise.resolve(true);
    // If a prompt is already up, piggyback on its outcome.
    if (pending.value) {
      const prev = pending.value;
      return new Promise((resolve) => {
        pending.value = {
          resolve: (ok) => {
            prev.resolve(ok);
            resolve(ok);
          },
        };
      });
    }
    return new Promise((resolve) => {
      pending.value = { resolve };
      promptOpen.value = true;
    });
  }

  /** Called by the modal. Returns true when the PIN was accepted. */
  async function submitPin(pin: string): Promise<boolean> {
    try {
      await $fetch("/api/auth/elevate", { method: "POST", body: { pin } });
      await refreshSession();
      return true;
    }
    catch {
      return false;
    }
  }

  function settlePrompt(ok: boolean) {
    promptOpen.value = false;
    pending.value?.resolve(ok);
    pending.value = null;
  }

  function isElevationError(err: unknown): boolean {
    const e = err as { statusCode?: number; data?: { statusMessage?: string }; statusMessage?: string };
    return (
      e?.statusCode === 403
      && (e?.statusMessage === "ELEVATION_REQUIRED"
        || e?.data?.statusMessage === "ELEVATION_REQUIRED")
    );
  }

  /**
   * Run an action behind the gate: prompt for a PIN if locked, and if the
   * server still answers ELEVATION_REQUIRED (window expired mid-action),
   * re-prompt once and retry.
   */
  async function gate<T>(fn: () => T | Promise<T>): Promise<T | undefined> {
    if (!(await ensureElevated()))
      return undefined;
    try {
      return await fn();
    }
    catch (err) {
      if (!isElevationError(err))
        throw err;
      if (!(await ensureElevated()))
        return undefined;
      return await fn();
    }
  }

  async function lockNow() {
    await $fetch("/api/auth/elevate", { method: "DELETE" });
    await refreshSession();
  }

  return {
    isAdmin,
    isUnlocked,
    secondsLeft,
    promptOpen,
    ensureElevated,
    submitPin,
    settlePrompt,
    gate,
    lockNow,
  };
}
