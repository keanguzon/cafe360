import { afterEach, describe, expect, it, vi } from "vitest";
import { forgotPasswordAction, loginAction, signupAction, updatePasswordAction, logoutAction } from "./auth-actions";

const { resetPasswordForEmail, signInWithPassword, signUp, getUser, updateUser, signOut } = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
  signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
  signUp: vi.fn().mockResolvedValue({ data: { user: {}, session: null }, error: null }),
  getUser: vi.fn().mockResolvedValue({ data: { user: { id: "member" } }, error: null }),
  updateUser: vi.fn().mockResolvedValue({ error: null }),
  signOut: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { resetPasswordForEmail, signInWithPassword, signUp, getUser, updateUser, signOut } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); },
}));

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("forgotPasswordAction", () => {
  it("returns error when email is missing or empty", async () => {
    const formData = new FormData();
    const result = await forgotPasswordAction(formData);
    expect(result.error).toBe("Enter a valid email address.");
  });

  it("returns error when email format is invalid", async () => {
    const formData = new FormData();
    formData.append("email", "notanemail");
    const result = await forgotPasswordAction(formData);
    expect(result.error).toBe("Enter a valid email address.");
  });

  it("returns success when valid email is submitted in demo mode without Supabase", async () => {
    const formData = new FormData();
    formData.append("email", "coffee.lover@example.com");
    const result = await forgotPasswordAction(formData);
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("uses the configured APP_URL for recovery emails", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://cafe.example.test/");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://legacy.example.test");
    const formData = new FormData();
    formData.set("email", "coffee@example.test");

    expect(await forgotPasswordAction(formData)).toEqual({ success: true });
    expect(resetPasswordForEmail).toHaveBeenCalledWith("coffee@example.test", {
      redirectTo: "https://cafe.example.test/callback?next=/reset-password",
    });
  });
});

describe("updatePasswordAction", () => {
  const form = (password: string, confirmation: string) => {
    const data = new FormData();
    data.set("password", password);
    data.set("confirmPassword", confirmation);
    return data;
  };
  const configured = () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
  };

  it("rejects passwords shorter than eight characters", async () => {
    expect((await updatePasswordAction(form("short", "short"))).error).toMatch(/8/);
  });
  it("rejects a confirmation that does not match", async () => {
    expect((await updatePasswordAction(form("long-enough", "different"))).error).toMatch(/match/i);
  });
  it("does not claim a password change in demo mode", async () => {
    expect(await updatePasswordAction(form("long-enough", "long-enough"))).toMatchObject({ success: false, error: expect.stringMatching(/configured/i) });
  });
  it("requires a recovered session", async () => {
    configured();
    getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    expect((await updatePasswordAction(form("long-enough", "long-enough"))).error).toMatch(/session|link/i);
    expect(updateUser).not.toHaveBeenCalled();
  });
  it("returns a safe error when password update fails", async () => {
    configured();
    updateUser.mockResolvedValueOnce({ error: new Error("internal secret") });
    expect((await updatePasswordAction(form("long-enough", "long-enough"))).error).not.toContain("internal secret");
  });
  it("updates the authenticated user's password", async () => {
    configured();
    expect(await updatePasswordAction(form("long-enough", "long-enough"))).toMatchObject({ success: true });
    expect(updateUser).toHaveBeenCalledWith({ password: "long-enough" });
  });
});

describe("login redirect", () => {
  it("rejects a protocol-relative next destination after login", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://cafe.test");
    const form = new FormData();
    form.set("email", "member@example.test");
    form.set("password", "password-for-test");
    form.set("next", "//evil.test");
    await expect(loginAction(null, form)).rejects.toThrow("REDIRECT:/profile");
  });
});

describe("signup redirect", () => {
  const form = (next: string) => {
    const data = new FormData();
    data.set("email", "member@example.test");
    data.set("password", "long-enough");
    data.set("displayName", "Member");
    data.set("username", "member");
    data.set("next", next);
    return data;
  };
  const configured = () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://cafe.example.test/");
  };

  it("preserves a local invite destination through email confirmation", async () => {
    configured();
    expect(await signupAction(null, form("/invite/accept?token=abc"))).toMatchObject({ success: true });
    const options = signUp.mock.calls.at(-1)?.[0].options;
    expect(options.emailRedirectTo).toBe("https://cafe.example.test/callback?next=%2Finvite%2Faccept%3Ftoken%3Dabc");
  });
  it("rejects unsafe signup destinations", async () => {
    configured();
    await signupAction(null, form("//evil.test"));
    expect(signUp.mock.calls.at(-1)?.[0].options.emailRedirectTo).toBe("https://cafe.example.test/callback?next=%2Fprofile");
  });
  it("redirects an immediately authenticated signup to its invite", async () => {
    configured();
    signUp.mockResolvedValueOnce({ data: { user: {}, session: {} }, error: null });
    await expect(signupAction(null, form("/invite/accept?token=abc"))).rejects.toThrow("REDIRECT:/invite/accept?token=abc");
  });
});

describe("logoutAction", () => {
  it("invalidates the root layout before redirecting after sign-out", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
    await expect(logoutAction()).rejects.toThrow("REDIRECT:/login");
    const { revalidatePath } = await import("next/cache");
    expect(signOut).toHaveBeenCalledOnce();
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });
  it("keeps the session screen and exposes a safe retry when sign-out fails", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
    signOut.mockResolvedValueOnce({ error: new Error("internal credential detail") });
    await expect(logoutAction()).resolves.toEqual({ error: "Could not sign out. Please try again." });
    const { revalidatePath } = await import("next/cache");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
