import { consola } from "consola";

export type PinnedNoteAuthor = {
  id: string;
  name: string;
  avatar: string | null;
  color: string | null;
};

export type PinnedNote = {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: PinnedNoteAuthor | null;
};

/** The Family Bulletin — global pinned notes shared at the top of the dashboard. */
export function usePinnedNotes() {
  const error = ref<string | null>(null);
  const requestFetch = useRequestFetch();

  const { data: notes, refresh } = useAsyncData(
    "pinned-notes",
    () => requestFetch<PinnedNote[]>("/api/pinned-notes"),
    { default: () => [], server: false },
  );

  // add/update throw on validation (400) so the component can surface the message.
  async function addNote(body: string) {
    await $fetch("/api/pinned-notes", { method: "POST", body: { body } });
    await refresh();
  }

  async function updateNote(id: string, body: string) {
    await $fetch(`/api/pinned-notes/${id}`, { method: "PUT", body: { body } });
    await refresh();
  }

  async function deleteNote(id: string) {
    try {
      await $fetch(`/api/pinned-notes/${id}`, { method: "DELETE" });
      await refresh();
    }
    catch (err) {
      error.value = "Failed to delete note";
      consola.error("usePinnedNotes delete:", err);
      throw err;
    }
  }

  return { notes, error: readonly(error), refresh, addNote, updateNote, deleteNote };
}
