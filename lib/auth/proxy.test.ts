import { describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { proxy } from "@/proxy";

const { updateSession } = vi.hoisted(() => ({ updateSession: vi.fn() }));
vi.mock("@/lib/supabase/middleware", () => ({ updateSession }));
vi.mock("@/lib/supabase/config", () => ({ hasSupabaseConfig: () => true }));

describe("auth proxy redirect", () => {
  it.each(["/offline.html", "/icons/cafe360.svg"])("serves the public PWA asset %s without authentication", async (path) => {
    updateSession.mockClear();
    updateSession.mockResolvedValue({ response: NextResponse.next(), userId: null });
    const result = await proxy(new NextRequest(`https://cafe.test${path}`));
    expect(result.headers.get("location")).toBeNull();
    expect(updateSession).not.toHaveBeenCalled();
  });
  it("preserves the requested invite query and refreshed session cookies", async () => {
    const sessionResponse = NextResponse.next();
    sessionResponse.cookies.set("session-test", "refreshed", { httpOnly: true });
    updateSession.mockResolvedValue({ response: sessionResponse, userId: null });
    const result = await proxy(new NextRequest("https://cafe.test/invite/ABC123?source=share"));
    const target = new URL(result.headers.get("location")!);
    expect(target.pathname).toBe("/login");
    expect(target.searchParams.get("next")).toBe("/invite/ABC123?source=share");
    expect(result.cookies.get("session-test")?.value).toBe("refreshed");
    expect(result.headers.get("set-cookie")).toContain("HttpOnly");
  });
});
