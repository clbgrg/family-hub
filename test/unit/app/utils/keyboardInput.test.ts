import { describe, expect, it } from "vitest";

import {
  applyCase,
  computeBackspace,
  computeInsert,
  isTextField,
  layoutForInput,
} from "../../../../app/utils/keyboardInput";

describe("layoutForInput", () => {
  it("picks numeric for numeric/decimal/tel inputmode", () => {
    expect(layoutForInput({ inputMode: "numeric" })).toBe("numeric");
    expect(layoutForInput({ inputMode: "decimal" })).toBe("numeric");
    expect(layoutForInput({ inputMode: "tel" })).toBe("numeric");
  });
  it("picks numeric for number/tel type", () => {
    expect(layoutForInput({ type: "number" })).toBe("numeric");
    expect(layoutForInput({ type: "tel" })).toBe("numeric");
  });
  it("defaults to qwerty (incl. password without numeric inputmode)", () => {
    expect(layoutForInput({ type: "text" })).toBe("qwerty");
    expect(layoutForInput({ type: "password" })).toBe("qwerty");
    expect(layoutForInput({})).toBe("qwerty");
  });
  it("treats a password+numeric PIN field as numeric", () => {
    expect(layoutForInput({ type: "password", inputMode: "numeric" })).toBe("numeric");
  });
});

describe("applyCase", () => {
  it("uppercases when shift xor caps", () => {
    expect(applyCase("a", { shift: true, caps: false })).toBe("A");
    expect(applyCase("a", { shift: false, caps: true })).toBe("A");
  });
  it("lowercases when neither or both", () => {
    expect(applyCase("a", { shift: false, caps: false })).toBe("a");
    expect(applyCase("a", { shift: true, caps: true })).toBe("a");
  });
  it("passes non-letters through unchanged", () => {
    expect(applyCase("5", { shift: true, caps: false })).toBe("5");
    expect(applyCase(".", { shift: false, caps: true })).toBe(".");
  });
});

describe("computeInsert", () => {
  it("inserts at the caret", () => {
    expect(computeInsert("helo", 4, 4, "!")).toEqual({ value: "helo!", caret: 5 });
  });
  it("replaces a selection", () => {
    expect(computeInsert("hello", 1, 4, "X")).toEqual({ value: "hXo", caret: 2 });
  });
  it("clamps out-of-range indices", () => {
    expect(computeInsert("ab", 99, 99, "c")).toEqual({ value: "abc", caret: 3 });
  });
});

describe("computeBackspace", () => {
  it("deletes the char before the caret", () => {
    expect(computeBackspace("abc", 3, 3)).toEqual({ value: "ab", caret: 2 });
  });
  it("deletes a selection", () => {
    expect(computeBackspace("abcdef", 1, 4)).toEqual({ value: "aef", caret: 1 });
  });
  it("is a no-op at the start", () => {
    expect(computeBackspace("abc", 0, 0)).toEqual({ value: "abc", caret: 0 });
  });
});

describe("isTextField", () => {
  const el = (tagName: string, type?: string) => ({ tagName, type }) as unknown as Element;
  it("accepts textarea and text-ish inputs", () => {
    expect(isTextField(el("TEXTAREA"))).toBe(true);
    expect(isTextField(el("INPUT", "text"))).toBe(true);
    expect(isTextField(el("INPUT", "password"))).toBe(true);
    expect(isTextField(el("INPUT", "email"))).toBe(true);
    expect(isTextField(el("INPUT", "number"))).toBe(true);
  });
  it("rejects non-text inputs and other elements", () => {
    expect(isTextField(el("INPUT", "checkbox"))).toBe(false);
    expect(isTextField(el("INPUT", "range"))).toBe(false);
    expect(isTextField(el("BUTTON"))).toBe(false);
    expect(isTextField(null)).toBe(false);
  });
});
