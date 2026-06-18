import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import handler from "~~/server/api/pinned-notes/[id].put";

const { defineEventHandler } = useH3TestUtils();

vi.mock("~/lib/prisma");

describe("pUT /api/pinned-notes/[id]", () => {
  it("is registered as an event handler", () =>
    expect(defineEventHandler).toHaveBeenCalled());

  it("updates the note body (trimmed)", async () => {
    const updated = {
      id: "n1",
      body: "Updated note",
      authorId: "u1",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prisma.pinnedNote.update.mockResolvedValue(updated);

    const event = createMockH3Event({ params: { id: "n1" }, body: { body: "  Updated note  " } });
    const res = await handler(event);

    expect(prisma.pinnedNote.update).toHaveBeenCalledWith({
      where: { id: "n1" },
      data: { body: "Updated note" },
      include: { author: { select: { id: true, name: true, avatar: true, color: true } } },
    });
    expect(res).toEqual(updated);
  });

  it("throws 400 when id is missing", async () => {
    const event = createMockH3Event({ params: {}, body: { body: "x" } });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when body is blank", async () => {
    const event = createMockH3Event({ params: { id: "n1" }, body: { body: "   " } });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("maps a missing row (P2025) to 404", async () => {
    prisma.pinnedNote.update.mockRejectedValue({ code: "P2025" });

    const event = createMockH3Event({ params: { id: "ghost" }, body: { body: "x" } });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 404 });
  });
});
