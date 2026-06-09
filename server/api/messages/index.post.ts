import prisma from "~/lib/prisma";

const MAX_LENGTH = 1000;
const EXPIRY_DAYS = 7;

/**
 * Post a note to the family board. Any authenticated member can post; validate
 * server-side (non-empty after trim, hard length cap). The author defaults to
 * the session user but can be set to any family member via `authorId` — the
 * board is a shared kiosk, so whoever walks up picks who it's from.
 */
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);

  const raw = await readBody(event);
  const body = String(raw?.body ?? "").trim();
  if (!body) {
    throw createError({ statusCode: 400, statusMessage: "Message can't be empty" });
  }
  if (body.length > MAX_LENGTH) {
    throw createError({ statusCode: 400, statusMessage: `Message too long (max ${MAX_LENGTH} characters)` });
  }

  let authorId = session.user.id;
  if (raw?.authorId && typeof raw.authorId === "string") {
    const author = await prisma.user.findUnique({ where: { id: raw.authorId }, select: { id: true } });
    if (!author) {
      throw createError({ statusCode: 400, statusMessage: "Unknown author" });
    }
    authorId = raw.authorId;
  }

  const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  return prisma.message.create({
    data: { body, authorId, expiresAt },
    include: { author: { select: { id: true, name: true, avatar: true, color: true } } },
  });
});
