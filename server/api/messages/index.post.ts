import prisma from "~/lib/prisma";

const MAX_LENGTH = 1000;
const EXPIRY_DAYS = 7;

/**
 * Post a note to the family board. Accepts JSON (plain note) or multipart/form-
 * data (note + a single attachment). Any authenticated member can post; the
 * author defaults to the session user but can be set to any family member via
 * `authorId` — the board is a shared kiosk, so whoever walks up picks who it's
 * from.
 */
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);

  const contentType = getHeader(event, "content-type") ?? "";
  let body: string;
  let rawAuthorId: string | undefined;
  let filePart: UploadPart | undefined;

  if (contentType.includes("multipart/form-data")) {
    const parts = await readMultipartFormData(event);
    const text = (name: string) => parts?.find(p => p.name === name && !p.filename)?.data.toString("utf8");
    body = (text("body") ?? "").trim();
    rawAuthorId = text("authorId") || undefined;
    const f = parts?.find(p => p.name === "file" && p.filename);
    if (f)
      filePart = { filename: f.filename, type: f.type, data: f.data };
  }
  else {
    const raw = await readBody(event);
    body = String(raw?.body ?? "").trim();
    rawAuthorId = typeof raw?.authorId === "string" ? raw.authorId : undefined;
  }

  if (!body) {
    throw createError({ statusCode: 400, statusMessage: "Message can't be empty" });
  }
  if (body.length > MAX_LENGTH) {
    throw createError({ statusCode: 400, statusMessage: `Message too long (max ${MAX_LENGTH} characters)` });
  }

  let authorId = session.user.id;
  if (rawAuthorId) {
    const author = await prisma.user.findUnique({ where: { id: rawAuthorId }, select: { id: true } });
    if (!author) {
      throw createError({ statusCode: 400, statusMessage: "Unknown author" });
    }
    authorId = rawAuthorId;
  }

  // Opportunistic housekeeping (no cron on the Pi): prune expired notes and the
  // attachment files they leave behind, so the files volume doesn't accumulate.
  const now = new Date();
  const staleWithFiles = await prisma.message.findMany({
    where: { expiresAt: { lt: now }, attachmentStoredName: { not: null } },
    select: { attachmentStoredName: true },
  });
  await prisma.message.deleteMany({ where: { expiresAt: { lt: now } } });
  await Promise.all(staleWithFiles.map(m => deleteStoredFile(m.attachmentStoredName!)));

  // Validate + store the attachment last, so a bad file rejects before we write.
  const stored = filePart ? await storeUpload(filePart, "msg") : null;

  const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  return prisma.message.create({
    data: {
      body,
      authorId,
      expiresAt,
      attachmentName: stored?.name ?? null,
      attachmentStoredName: stored?.storedName ?? null,
      attachmentType: stored?.type ?? null,
      attachmentSize: stored?.size ?? null,
    },
    include: { author: { select: { id: true, name: true, avatar: true, color: true } } },
  });
});
