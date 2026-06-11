import type { Ref } from "vue";

export type SchoolNote = {
  userId: string;
  date: string;
  text: string;
};

/** School notes for the given Mon–Fri week (`weekStart` is a YYYY-MM-DD Monday). */
export function useSchool(weekStart: Ref<string>) {
  const requestFetch = useRequestFetch();
  const start = computed(() => weekStart.value);
  const end = computed(() => addDaysIso(start.value, 4)); // Mon..Fri

  const { data: notes, refresh } = useAsyncData(
    "school-notes",
    () => requestFetch<SchoolNote[]>("/api/school-notes", { query: { start: start.value, end: end.value } }),
    { default: () => [], server: false, watch: [start] },
  );

  const noteByCell = computed(() => {
    const map: Record<string, string> = {};
    for (const n of notes.value ?? []) map[`${n.userId}|${n.date}`] = n.text;
    return map;
  });

  async function saveNote(userId: string, date: string, text: string) {
    await $fetch("/api/school-notes", { method: "PUT", body: { userId, date, text } });
    await refresh();
  }

  return { notes, noteByCell, saveNote, refresh };
}
