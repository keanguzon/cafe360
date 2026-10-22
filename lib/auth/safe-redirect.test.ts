import { describe, expect, it } from "vitest";
import { getSafeRedirectPath } from "./safe-redirect";

describe("getSafeRedirectPath", () => {
  it("preserves a local invite destination and its query", () => {
    expect(getSafeRedirectPath("/invite/ABC123?nextStep=join", "https://cafe.test"))
      .toBe("/invite/ABC123?nextStep=join");
  });

  it.each([
    null, "", "//evil.test", "https://evil.test", "@evil.test", "/\\evil.test",
    "/%2f%2fevil.test", "/%5cevil.test", "/%252f%252fevil.test", "/\nevil.test",
    "///evil.test", " /profile", "/%zz",
  ])("rejects unsafe destination %s", (input) => {
    expect(getSafeRedirectPath(input, "https://cafe.test")).toBe("/map");
  });

  it("keeps query text separate from path validation", () => {
    expect(getSafeRedirectPath("/discover?q=coffee%20shop", "https://cafe.test"))
      .toBe("/discover?q=coffee%20shop");
  });
});
