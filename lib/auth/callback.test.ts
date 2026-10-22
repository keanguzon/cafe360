import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/(auth)/callback/route";

const { exchangeCodeForSession } = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { exchangeCodeForSession } }),
}));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-test-key");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://cafe.test");
  exchangeCodeForSession.mockResolvedValue({ error: null });
});

describe("auth callback", () => {
  it("preserves a local invitation on the trusted app origin", async () => {
    const response = await GET(new NextRequest("https://cafe.test/callback?code=test&next=%2Finvite%2FABC123"));
    expect(response.headers.get("location")).toBe("https://cafe.test/invite/ABC123");
  });

  it("ignores untrusted forwarded host and rejects an external destination", async () => {
    const response = await GET(new NextRequest("https://cafe.test/callback?code=test&next=%40evil.test", {
      headers: { "x-forwarded-host": "evil.test" },
    }));
    expect(response.headers.get("location")).toBe("https://cafe.test/map");
  });

  it("returns failed exchanges to login without following next", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: "Expired code" } });
    const response = await GET(new NextRequest("https://cafe.test/callback?code=expired&next=%2Fprofile"));
    expect(response.headers.get("location")).toBe("https://cafe.test/login?error=oauth_callback_failed");
  });
});
