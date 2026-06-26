// The task a countdown timer is (about to be) running for. One timer at a
// time — it's a kiosk, and "Read for 15 minutes" is a one-kid-at-a-time thing.
// A "free" timer is a plain countdown not tied to any chore/school item.
export type TimerTask
  = | { kind: "chore"; id: string; userId: string; title: string; assigneeName: string }
    | { kind: "school"; id: string; title: string }
    | { kind: "free"; title?: string };

export type TimerPhase = "pick" | "running" | "paused" | "finishing";

/**
 * Global task-timer state. Any caller can launch the timer; the overlay
 * (mounted once in app.vue) renders it and drives completion. The live
 * countdown state lives HERE (not in the overlay) so the screensaver can show
 * it too, and the single ticker keeps running even while the overlay is hidden
 * behind the screensaver.
 */

// Module-level singleton ticker (client-only; never created on the server).
let tick: ReturnType<typeof setInterval> | null = null;

function stopTick() {
  if (tick) {
    clearInterval(tick);
    tick = null;
  }
}

export function useTaskTimer() {
  const task = useState<TimerTask | null>("task-timer", () => null);
  const phase = useState<TimerPhase>("task-timer-phase", () => "pick");
  const minutes = useState<number>("task-timer-minutes", () => 15);
  const endsAt = useState<number>("task-timer-ends-at", () => 0);
  const remainingMs = useState<number>("task-timer-remaining", () => 0);

  function startTimerFor(t: TimerTask) {
    stopTick();
    task.value = t;
    phase.value = "pick";
    minutes.value = 15;
    remainingMs.value = 0;
  }

  function start() {
    const mins = Math.min(180, Math.max(1, Math.round(Number(minutes.value) || 1)));
    minutes.value = mins;
    remainingMs.value = mins * 60_000;
    resume();
  }

  function resume() {
    endsAt.value = Date.now() + remainingMs.value;
    phase.value = "running";
    stopTick();
    if (import.meta.client) {
      tick = setInterval(() => {
        remainingMs.value = Math.max(0, endsAt.value - Date.now());
        if (remainingMs.value <= 0) {
          stopTick();
          // The overlay watches this transition and runs completion.
          phase.value = "finishing";
        }
      }, 250);
    }
  }

  function pause() {
    remainingMs.value = Math.max(0, endsAt.value - Date.now());
    stopTick();
    phase.value = "paused";
  }

  function closeTimer() {
    stopTick();
    task.value = null;
    phase.value = "pick";
    remainingMs.value = 0;
  }

  const clock = computed(() => {
    const total = Math.ceil(remainingMs.value / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  });

  // Actively timing (countdown visible) — used to decide whether to surface the
  // timer on the dashboard header and the screensaver.
  const active = computed(() => phase.value === "running" || phase.value === "paused");

  const displayTitle = computed(() =>
    task.value?.title || (task.value?.kind === "free" ? "Timer" : ""),
  );

  return {
    task,
    phase,
    minutes,
    endsAt,
    remainingMs,
    clock,
    active,
    displayTitle,
    startTimerFor,
    start,
    resume,
    pause,
    stopTick,
    closeTimer,
  };
}
