import { afterEach, expect, it, vi } from "vitest";
import { createAdminClient } from "./admin";

afterEach(() => vi.unstubAllGlobals());

it("passes the new-format secret through the installed SDK apikey header without cookies", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
  vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_transport-test-only");
  const requests: Headers[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    requests.push(new Headers(init?.headers));
    return new Response("[]", { headers: { "Content-Type": "application/json" } });
  }));
  const { error } = await createAdminClient().from("cafes").select("id").limit(0);
  expect(error).toBeNull();
  expect(requests).toHaveLength(1);
  expect(requests[0].get("apikey")).toBe("sb_secret_transport-test-only");
  expect(requests[0].get("cookie")).toBeNull();
});
