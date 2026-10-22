import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAdminClient } from "./admin";

const client = vi.hoisted(() => vi.fn<(...args: unknown[]) => { kind: string }>(() => ({ kind: "admin" })));
vi.mock("@supabase/supabase-js", () => ({ createClient: client }));

beforeEach(() => {
  client.mockClear();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
  vi.stubEnv("SUPABASE_SECRET_KEY", "");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
});

describe("server-only admin credentials", () => {
  it("prefers the new secret key and disables browser session persistence", () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", " sb_secret_test-only ");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "legacy-test-only");
    createAdminClient();
    expect(client).toHaveBeenCalledWith("https://project.supabase.co", "sb_secret_test-only", {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  });

  it("uses the legacy key when the new variable is blank", () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "  ");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", " legacy-test-only ");
    createAdminClient();
    expect(client.mock.calls[0]?.[1]).toBe("legacy-test-only");
  });

  it("fails without a server secret instead of using the public key", () => {
    expect(() => createAdminClient()).toThrow("SUPABASE_SECRET_KEY");
    expect(client).not.toHaveBeenCalled();
  });
});
