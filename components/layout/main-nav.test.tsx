// @vitest-environment jsdom

import { act, createContext, useContext } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BottomNav, MainNav } from "./main-nav";

const navigation = vi.hoisted(() => ({ pathname: "/map", pendingHref: null as string | null, shellActive: false }));
const LinkHrefContext = createContext<string | null>(null);

vi.mock("@/lib/context/map-shell-presence", () => ({ useMapShellPresence: () => ({ active: navigation.shellActive }) }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, prefetch, ...props }: ComponentProps<"a"> & { prefetch?: boolean }) => {
    void prefetch;
    const linkHref = typeof href === "string" ? href : null;
    return (
      <LinkHrefContext.Provider value={linkHref}>
        <a href={href} {...props}>
          {children}
        </a>
      </LinkHrefContext.Provider>
    );
  },
  useLinkStatus: () => {
    const href = useContext(LinkHrefContext);
    return { pending: href !== null && navigation.pendingHref === href };
  },
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ setTheme: vi.fn(), resolvedTheme: "light" }),
}));

vi.mock("@/components/auth/sign-out-modal", () => ({
  SignOutModal: () => null,
}));

describe("main navigation", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    navigation.pendingHref = null;
    navigation.shellActive = false;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function renderNavigation(pathname: string) {
    navigation.pathname = pathname;
    act(() => root.render(<><MainNav /><BottomNav /></>));
    return {
      desktop: container.querySelector("header nav")!,
      mobile: container.querySelector('nav[aria-label="Mobile navigation"]')!,
    };
  }

  it("links to Saved from both desktop and mobile navigation", () => {
    const { desktop, mobile } = renderNavigation("/map");

    for (const nav of [desktop, mobile]) {
      const savedLink = nav.querySelector<HTMLAnchorElement>('a[href="/profile/collections"]');
      expect(savedLink?.textContent?.trim()).toBe("Saved");
    }
  });

  it("hides the mobile app header before the map shell mounts", () => {
    renderNavigation("/map");
    expect(container.querySelector("header")?.classList.contains("hidden")).toBe(true);
    renderNavigation("/profile");
    expect(container.querySelector("header")?.classList.contains("hidden")).toBe(false);
  });

  it.each([
    ["/profile/collections", "Saved"],
    ["/profile/collections/caf%C3%A9%20lounge", "Saved"],
    ["/profile", "You"],
    ["/map", "Map"],
  ])("marks only %s navigation as current at %s", (pathname, activeLabel) => {
    const { desktop, mobile } = renderNavigation(pathname);

    for (const nav of [desktop, mobile]) {
      const activeLinks = Array.from(nav.querySelectorAll<HTMLAnchorElement>("a[aria-current='page']"));
      expect(activeLinks.map((link) => link.textContent?.trim())).toEqual([activeLabel]);
    }
  });

  it("shows an immediate loading indicator and top progress bar when a navigation link is pending", () => {
    navigation.pendingHref = "/profile/collections";
    const { desktop, mobile } = renderNavigation("/map");

    for (const nav of [desktop, mobile]) {
      const savedLink = nav.querySelector<HTMLAnchorElement>('a[href="/profile/collections"]');
      expect(savedLink?.querySelector('[data-nav-pending="true"]')).not.toBeNull();
    }
    expect(document.body.querySelector('[role="status"][aria-label="Loading page"]')).not.toBeNull();
    expect(container.querySelector('[role="status"][aria-label="Loading page"]')).toBeNull();
  });
  it("keeps personal navigation available beside the Circle map", () => {
    navigation.shellActive = true;
    renderNavigation("/profile/collections");
    expect(container.querySelector("header")).not.toBeNull();
    expect(container.querySelector('nav[aria-label="Mobile navigation"]')).not.toBeNull();
  });

  it("anchors mobile navigation to the viewport and reserves its space once", () => {
    const { mobile } = renderNavigation("/map");
    expect(mobile.classList.contains("fixed")).toBe(true);
    expect(mobile.classList.contains("bottom-0")).toBe(true);
    const space = container.querySelector('[data-bottom-nav-space]');
    expect(space?.getAttribute('aria-hidden')).toBe('true');
    expect(space?.className).toContain('h-[calc(3.5rem_+_1px_+_env(safe-area-inset-bottom))]');
    expect(mobile.className).toContain("pb-[env(safe-area-inset-bottom)]");
  });});

