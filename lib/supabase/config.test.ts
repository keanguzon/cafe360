import { afterEach, describe, expect, it, vi } from "vitest";

import { getSupabaseConfig, hasSupabaseConfig } from "./config";

describe("hasSupabaseConfig", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("fails closed when runtime configuration is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false");
    expect(() => hasSupabaseConfig()).toThrow(/Missing Supabase configuration/);
  });

  it("rejects demo mode in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    expect(() => hasSupabaseConfig()).toThrow(/Missing Supabase configuration/);
  });

  it("permits an explicit development demo opt-in", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    expect(hasSupabaseConfig()).toBe(false);
  });

  it("accepts a configured publishable key at runtime", () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
    expect(hasSupabaseConfig()).toBe(true);
  });

  it("falls back to a legacy anon key when the publishable key is whitespace", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "  ");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", " anon-key ");
    expect(hasSupabaseConfig()).toBe(true);
    expect(getSupabaseConfig().publishableKey).toBe("anon-key");
  });

  it("returns true when both public Supabase values exist", () => {
    expect(
      hasSupabaseConfig({
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      }),
    ).toBe(true);
  });

  it("returns false when either public Supabase value is missing", () => {
    expect(
      hasSupabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" }),
    ).toBe(false);
  });
});
