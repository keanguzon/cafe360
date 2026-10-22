import { describe, expect, it } from "vitest";

import { getAuthRouteRedirect } from "./route-guard";

describe("getAuthRouteRedirect", () => {
  it("allows unauthenticated access to public routes", () => {
    expect(getAuthRouteRedirect("/", false)).toBeNull();
    expect(getAuthRouteRedirect("/login", false)).toBeNull();
    expect(getAuthRouteRedirect("/signup", false)).toBeNull();
    expect(getAuthRouteRedirect("/forgot-password", false)).toBeNull();
    expect(getAuthRouteRedirect("/callback", false)).toBeNull();
    expect(getAuthRouteRedirect("/api/health", false)).toBeNull();
  });

  it("redirects unauthenticated users from protected features to login", () => {
    expect(getAuthRouteRedirect("/map", false)).toBe("/login?next=%2Fmap");
    expect(getAuthRouteRedirect("/discover", false)).toBe("/login?next=%2Fdiscover");
    expect(getAuthRouteRedirect("/circles", false)).toBe("/login?next=%2Fcircles");
    expect(getAuthRouteRedirect("/profile", false)).toBe("/login?next=%2Fprofile");
    expect(getAuthRouteRedirect("/profile/collections", false)).toBe(
      "/login?next=%2Fprofile%2Fcollections",
    );
    expect(getAuthRouteRedirect("/invite", false)).toBe("/login?next=%2Finvite");
  });

  it("redirects authenticated users away from auth and landing pages to map", () => {
    expect(getAuthRouteRedirect("/", true)).toBe("/map");
    expect(getAuthRouteRedirect("/login", true)).toBe("/map");
    expect(getAuthRouteRedirect("/signup", true)).toBe("/map");
    expect(getAuthRouteRedirect("/forgot-password", true)).toBe("/map");
  });

  it("allows authenticated users access to protected features", () => {
    expect(getAuthRouteRedirect("/map", true)).toBeNull();
    expect(getAuthRouteRedirect("/discover", true)).toBeNull();
    expect(getAuthRouteRedirect("/circles", true)).toBeNull();
    expect(getAuthRouteRedirect("/profile", true)).toBeNull();
  });
});
