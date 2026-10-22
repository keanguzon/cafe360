import { describe, expect, it } from "vitest";

import { getAppUrl } from "./app";

describe("getAppUrl", () => {
  it("prefers the trimmed app URL and removes its root slash", () => {
    expect(
      getAppUrl({
        NEXT_PUBLIC_APP_URL: "  https://app.example.test/  ",
        NEXT_PUBLIC_SITE_URL: "https://legacy.example.test/",
        NODE_ENV: "production",
      }),
    ).toBe("https://app.example.test");
  });

  it("uses the legacy site URL when the app URL is blank", () => {
    expect(
      getAppUrl({
        NEXT_PUBLIC_APP_URL: "  ",
        NEXT_PUBLIC_SITE_URL: " https://legacy.example.test/ ",
      }),
    ).toBe("https://legacy.example.test");
  });

  it("returns the local URL when development or test has no configured URL", () => {
    expect(getAppUrl({ NODE_ENV: "development" })).toBe("http://localhost:3000");
    expect(getAppUrl({ NODE_ENV: "test" })).toBe("http://localhost:3000");
  });

  it("throws a clear error when production has no configured URL", () => {
    expect(() => getAppUrl({ NODE_ENV: "production" })).toThrow(
      "NEXT_PUBLIC_APP_URL must be set in production",
    );
  });

  it("throws when the preferred app URL is invalid instead of falling back", () => {
    expect(() =>
      getAppUrl({
        NEXT_PUBLIC_APP_URL: "ftp://app.example.test/",
        NEXT_PUBLIC_SITE_URL: "https://legacy.example.test/",
      }),
    ).toThrow();
  });

  it.each([
    "not-a-url",
    "ftp://app.example.test/",
    "https://user:secret@app.example.test/",
    "https://@app.example.test/",
    "https://app.example.test/path",
    "https://app.example.test/.",
    "https://app.example.test/..",
    "https://app.example.test/%2e",
    "https://app.example.test/%2e%2e",
    "https://app.example.test//",
    "https://app.example.test\\path",
    "https://app.example.test/?mode=test",
    "https://app.example.test/?",
    "https://app.example.test/#section",
    "https://app.example.test/#",
  ])("rejects invalid configured URL %s", (value) => {
    expect(() => getAppUrl({ NEXT_PUBLIC_APP_URL: value })).toThrow();
  });
});
