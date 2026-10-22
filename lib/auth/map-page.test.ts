import { beforeEach, expect, it, vi } from "vitest";
import MapLayout from "@/app/(main)/map/layout";
const mocks = vi.hoisted(() => ({ configured: vi.fn(), create: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ hasSupabaseConfig: mocks.configured }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.create }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/components/map/map-shell", () => ({ MapShell: () => null }));
vi.mock("@/lib/context/map-shell-presence", () => ({ MapShellMount: () => null }));
vi.mock("@/lib/context/sheet-navigation", () => ({ SheetNavigationProvider: () => null }));
beforeEach(() => { vi.resetAllMocks(); mocks.configured.mockReturnValue(false); mocks.create.mockRejectedValue(new Error("Missing configuration")); });
it("renders the explicit local demo without constructing a Supabase client", async () => {
  await expect(MapLayout({children:null,sheet:null})).resolves.toBeDefined();
  expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.redirect).not.toHaveBeenCalled();
});
it("redirects a configured unauthenticated map request to login with its destination", async () => {
  mocks.configured.mockReturnValue(true);
  mocks.create.mockResolvedValue({auth:{getUser:vi.fn().mockResolvedValue({data:{user:null}})}});
  mocks.redirect.mockImplementation(()=>{throw new Error("NEXT_REDIRECT");});
  await expect(MapLayout({children:null,sheet:null})).rejects.toThrow("NEXT_REDIRECT");
  expect(mocks.redirect).toHaveBeenCalledWith("/login?next=%2Fmap");
});
