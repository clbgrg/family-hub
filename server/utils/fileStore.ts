import type { H3Event } from "h3";
import type { Buffer } from "node:buffer";

import { createError, setHeader } from "h3";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { basename, resolve, sep } from "node:path";

import { filesDir } from "./filesDir";

// Shared file storage for family documents and message attachments. One
// allowlist, one size cap, one set of path guards — so the security-sensitive
// bits live in a single, tested place instead of being copy-pasted per feature.

// MIME → extension allowlist (documents + media). The on-disk name is fully
// generated from this extension, never from user input.
export const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

/** The file extension for a MIME type, or null if it isn't on the allowlist. */
export function extForType(type: string | undefined | null): string | null {
  return EXT_BY_TYPE[type ?? ""] ?? null;
}

/**
 * Resolve a server-generated stored name to an absolute path inside filesDir,
 * rejecting anything that could escape the directory (defense in depth — the
 * name is generated, but never trust it blindly).
 */
export function resolveStoredPath(storedName: string): string {
  const dir = filesDir();
  const full = resolve(dir, storedName);
  if (storedName !== basename(storedName) || storedName.includes("..") || !full.startsWith(dir + sep)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid path" });
  }
  return full;
}

export type UploadPart = { filename?: string; type?: string; data: Buffer };
export type StoredFile = { storedName: string; name: string; type: string; size: number };

/**
 * Validate an uploaded part against the allowlist + size cap and write it to
 * filesDir under a generated name. Returns the metadata to persist. Throws a
 * 400 for an empty, oversized, or disallowed file.
 */
export async function storeUpload(part: UploadPart | undefined, prefix: string): Promise<StoredFile> {
  if (!part || !part.data?.length) {
    throw createError({ statusCode: 400, statusMessage: "No file uploaded" });
  }
  const ext = extForType(part.type);
  if (!ext) {
    throw createError({ statusCode: 400, statusMessage: "Unsupported file type" });
  }
  if (part.data.length > MAX_UPLOAD_BYTES) {
    throw createError({ statusCode: 400, statusMessage: "File too large (max 25 MB)" });
  }

  const storedName = `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
  const dir = filesDir();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(resolve(dir, storedName), part.data);

  return {
    storedName,
    name: (part.filename || storedName).slice(0, 200),
    type: part.type || "application/octet-stream",
    size: part.data.length,
  };
}

/**
 * Serve a stored file's bytes inline (PDFs/images open in the browser). Sets
 * content-type, a sanitized filename, and a private cache header. 404 if the
 * row's file is missing from disk.
 */
export async function serveStoredFile(event: H3Event, storedName: string, displayName: string, type: string) {
  const full = resolveStoredPath(storedName);
  try {
    const data = await fs.readFile(full);
    setHeader(event, "Content-Type", type || "application/octet-stream");
    setHeader(event, "Content-Disposition", `inline; filename="${displayName.replace(/["\\\r\n]/g, "_")}"`);
    setHeader(event, "Cache-Control", "private, max-age=3600");
    return data;
  }
  catch {
    throw createError({ statusCode: 404, statusMessage: "File not found" });
  }
}

/** Delete a stored file, ignoring a missing file or an invalid path. */
export async function deleteStoredFile(storedName: string): Promise<void> {
  let full: string;
  try {
    full = resolveStoredPath(storedName);
  }
  catch {
    return; // never let a bad name turn into an unlink elsewhere
  }
  await fs.rm(full, { force: true });
}
