// The task a countdown timer is (about to be) running for. One timer at a
// time — it's a kiosk, and "Read for 15 minutes" is a one-kid-at-a-time thing.
export type TimerTask
  = | { kind: "chore"; id: string; userId: string; title: string; assigneeName: string }
    | { kind: "school"; id: string; title: string };

/**
 * Global task-timer state. Any task row can launch the timer; the overlay
 * (mounted once in app.vue) renders and runs it.
 */
export function useTaskTimer() {
  const task = useState<TimerTask | null>("task-timer", () => null);

  function startTimerFor(t: TimerTask) {
    task.value = t;
  }
  function closeTimer() {
    task.value = null;
  }

  return { task, startTimerFor, closeTimer };
}
