import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import handler from "~~/server/api/saved-meals/[id].put";

const { defineEventHandler } = useH3TestUtils();

vi.mock("~/lib/prisma");

describe("pUT /api/saved-meals/[id]", () => {
  it("is registered as an event handler", () =>
    expect(defineEventHandler).toHaveBeenCalled());

  const createBaseSavedMeal = (overrides = {}) => ({
    id: "meal-1",
    title: "Test Meal",
    notes: null,
    ingredients: null,
    defaultDays: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  describe("updates a saved meal successfully", () => {
    it("trims fields and writes title/notes/ingredients", async () => {
      const updated = createBaseSavedMeal({ title: "Taco Tuesday", notes: "recipe link", ingredients: "beef\nshells" });
      prisma.savedMeal.update.mockResolvedValue(updated);

      const event = createMockH3Event({
        params: { id: "meal-1" },
        body: { title: "  Taco Tuesday  ", notes: " recipe link ", ingredients: "beef\nshells" },
      });

      const response = await handler(event);

      expect(prisma.savedMeal.update).toHaveBeenCalledWith({
        where: { id: "meal-1" },
        data: { title: "Taco Tuesday", notes: "recipe link", ingredients: "beef\nshells", defaultDays: [] },
      });
      expect(response).toEqual(updated);
    });

    it("nulls out blank optional fields", async () => {
      prisma.savedMeal.update.mockResolvedValue(createBaseSavedMeal({ title: "Plain" }));

      const event = createMockH3Event({
        params: { id: "meal-1" },
        body: { title: "Plain", notes: "   ", ingredients: "" },
      });

      await handler(event);

      expect(prisma.savedMeal.update).toHaveBeenCalledWith({
        where: { id: "meal-1" },
        data: { title: "Plain", notes: null, ingredients: null, defaultDays: [] },
      });
    });

    it("normalizes defaultDays (dedups, sorts, drops invalid)", async () => {
      prisma.savedMeal.update.mockResolvedValue(createBaseSavedMeal({ defaultDays: [1, 3] }));

      const event = createMockH3Event({
        params: { id: "meal-1" },
        body: { title: "Taco", defaultDays: [3, 1, 1, 9, -1, 2.5] },
      });

      await handler(event);

      expect(prisma.savedMeal.update).toHaveBeenCalledWith({
        where: { id: "meal-1" },
        data: { title: "Taco", notes: null, ingredients: null, defaultDays: [1, 3] },
      });
    });
  });

  describe("error handling", () => {
    it("throws 400 when id is missing", async () => {
      const event = createMockH3Event({ params: {}, body: { title: "X" } });
      await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
    });

    it("throws 400 when title is blank", async () => {
      const event = createMockH3Event({ params: { id: "meal-1" }, body: { title: "   " } });
      await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
    });

    it("maps a missing row (P2025) to 404", async () => {
      prisma.savedMeal.update.mockRejectedValue({ code: "P2025" });

      const event = createMockH3Event({ params: { id: "ghost" }, body: { title: "X" } });
      await expect(handler(event)).rejects.toMatchObject({ statusCode: 404 });
    });

    it("rethrows unexpected database errors", async () => {
      prisma.savedMeal.update.mockRejectedValue(new Error("Database error"));

      const event = createMockH3Event({ params: { id: "meal-1" }, body: { title: "X" } });
      await expect(handler(event)).rejects.toThrow();
    });
  });
});
