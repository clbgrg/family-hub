export type DocumentItem = {
  id: string;
  name: string;
  type: string;
  size: number;
  createdAt: string;
  url: string;
};

export function useDocuments() {
  const requestFetch = useRequestFetch();
  const { data: documents, refresh } = useAsyncData(
    "documents",
    () => requestFetch<DocumentItem[]>("/api/documents"),
    { default: () => [], server: false },
  );

  async function upload(file: File) {
    const form = new FormData();
    form.append("file", file);
    await $fetch("/api/documents", { method: "POST", body: form });
    await refresh();
  }
  async function remove(id: string) {
    await $fetch(`/api/documents/${id}`, { method: "DELETE" });
    await refresh();
  }

  return { documents, refresh, upload, remove };
}
