/// <reference types="vite/client" />
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import MainLayout from "./(main)/layout";
const session = vi.hoisted(() => ({ user: { id: "account-a", email: "a@example.com" } as {id:string;email:string} | null, count: 0 }));
vi.mock("next/navigation", () => ({ redirect: (href: string) => { throw new Error(`redirect:${href}`); } }));
vi.mock("@/lib/supabase/config", () => ({ hasSupabaseConfig: () => true }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({data:{user:session.user}}) }, from: () => ({ select: () => ({eq: async () => ({count:session.count,error:null})}) }) }) }));
vi.mock("@/components/layout/main-nav", () => ({ MainNav: () => null, BottomNav: () => null }));
vi.mock("@/lib/context/circle-context", () => ({ CircleProvider: ({children}:{children:ReactNode}) => children }));
vi.mock("@/lib/context/navigation-state", () => ({ NavigationStateProvider: ({children}:{children:ReactNode}) => children }));
vi.mock("@/lib/context/map-shell-presence", () => ({ MapShellPresenceProvider: ({children}:{children:ReactNode}) => children }));
vi.mock("@/components/providers/authenticated-boundary", () => ({ AuthenticatedBoundary: ({children}:{children:ReactNode}) => children }));
vi.mock("@/components/pwa/service-worker-registration", () => ({ PwaStatus: () => null }));
const pages = import.meta.glob("./*/settings/page.tsx");
const layouts = import.meta.glob<{default:typeof MainLayout}>("./*/layout.tsx");
async function settingsLayout() {
  const routes = Object.keys(pages);
  expect(routes).toHaveLength(1);
  const owner = routes[0].replace("/settings/page.tsx", "/layout.tsx");
  return (await layouts[owner]()).default({children:"Settings"});
}
beforeEach(() => { session.user={id:"account-a",email:"a@example.com"}; session.count=0; });
it("lets an authenticated account with no Circles reach its registered Settings route", async () => {
  await expect(settingsLayout()).resolves.toBeTruthy();
});
it("requires login for the registered Settings route", async () => {
  session.user=null;
  await expect(settingsLayout()).rejects.toThrow("redirect:/login");
});
it("keeps the Circle requirement for main routes", async () => {
  await expect(MainLayout({children:"Map"})).rejects.toThrow("redirect:/onboarding");
});
it("lets existing members reach Settings", async () => {
  session.count=1;
  await expect(settingsLayout()).resolves.toBeTruthy();
});

