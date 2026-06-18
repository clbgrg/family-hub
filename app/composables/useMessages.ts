import { consola } from "consola";

export type MessageAuthor = {
  id: string;
  name: string;
  avatar: string | null;
  color: string | null;
};

export type Message = {
  id: string;
  body: string;
  createdAt: string;
  expiresAt: string;
  author: MessageAuthor;
  attachmentName: string | null;
  attachmentType: string | null;
  attachmentSize: number | null;
};

export function useMessages() {
  const error = ref<string | null>(null);
  const requestFetch = useRequestFetch();

  const { data: messages, refresh } = useAsyncData(
    "messages",
    () => requestFetch<Message[]>("/api/messages"),
    { default: () => [], server: false },
  );

  // Throws on validation errors (400) so the page can surface the message.
  // authorId defaults to the session user server-side; pass it to post "from"
  // another family member on the shared board.
  // Sends multipart when a file is attached, JSON otherwise. authorId defaults
  // to the session user server-side; pass it to post "from" another member.
  async function postMessage(body: string, authorId?: string, file?: File | null) {
    if (file) {
      const fd = new FormData();
      fd.append("body", body);
      if (authorId)
        fd.append("authorId", authorId);
      fd.append("file", file);
      await $fetch("/api/messages", { method: "POST", body: fd });
    }
    else {
      await $fetch("/api/messages", { method: "POST", body: { body, authorId } });
    }
    await refresh();
  }

  async function deleteMessage(id: string) {
    try {
      await $fetch(`/api/messages/${id}`, { method: "DELETE" });
      await refresh();
    }
    catch (err) {
      error.value = "Failed to delete message";
      consola.error("useMessages delete:", err);
      throw err;
    }
  }

  return { messages, error: readonly(error), refresh, postMessage, deleteMessage };
}
