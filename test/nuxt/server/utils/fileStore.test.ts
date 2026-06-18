import { describe, expect, it } from "vitest";

import { extForType, resolveStoredPath } from "~~/server/utils/fileStore";

describe("extForType", () => {
  it("maps allowlisted MIME types to extensions", () => {
    expect(extForType("image/png")).toBe("png");
    expect(extForType("application/pdf")).toBe("pdf");
    expect(extForType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe("xlsx");
  });

  it("returns null for unknown or missing types", () => {
    expect(extForType("application/x-msdownload")).toBeNull();
    expect(extForType("")).toBeNull();
    expect(extForType(undefined)).toBeNull();
    expect(extForType(null)).toBeNull();
  });
});

describe("resolveStoredPath", () => {
  it("accepts a plain server-generated name", () => {
    expect(resolveStoredPath("doc-123-abcd1234.pdf").endsWith("doc-123-abcd1234.pdf")).toBe(true);
  });

  it("rejects traversal, separators, and absolute paths", () => {
    expect(() => resolveStoredPath("../secret")).toThrow();
    expect(() => resolveStoredPath("sub/dir.pdf")).toThrow();
    expect(() => resolveStoredPath("a/../../etc/passwd")).toThrow();
    expect(() => resolveStoredPath("/etc/passwd")).toThrow();
  });
});
