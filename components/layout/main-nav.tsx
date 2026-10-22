"use client";

import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { NavigationLink as Link } from "@/components/navigation/navigation-feedback";
import { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Bookmark, Loader2, LogOut, MapPin, Moon, Sun, User, type LucideIcon } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { SignOutModal } from "@/components/auth/sign-out-modal";
import { useMapShellPresence } from "@/lib/context/map-shell-presence";
import { usePendingFeedback } from "@/lib/hooks/use-pending-feedback";

const navItems = [
  { href: "/map", label: "Map", icon: MapPin },
  { href: "/profile/collections", label: "Saved", icon: Bookmark },
  { href: "/profile", label: "You", icon: User },
];

function isNavItemActive(pathname: string, href: string) {
  const isWithinRoute = pathname === href || pathname.startsWith(`${href}/`);
  const isSavedRoute =
    pathname === "/profile/collections" ||
    pathname.startsWith("/profile/collections/");

  return isWithinRoute && !(href === "/profile" && isSavedRoute);
}

function NavPendingBar({ mobile = false }: { mobile?: boolean }) {
  return createPortal(
    <div
      role="status"
      aria-label="Loading page"
      className={`pointer-events-none fixed inset-x-0 top-0 z-100 h-1 overflow-hidden bg-accent/20 ${mobile ? "md:hidden" : "hidden md:block"}`}
    >
      <div className="h-full w-full animate-pulse bg-accent motion-reduce:animate-none" />
    </div>,
    document.body,
  );
}

function DesktopNavItemContent({ icon: Icon, label, isActive }: { icon: LucideIcon; label: string; isActive: boolean }) {
  const { pending } = useLinkStatus();
  const phase = usePendingFeedback({ pending, operationKey: label });
  const showSpinner = phase === "pending";
  return (
    <>
      {showSpinner && <NavPendingBar />}
      {showSpinner ? (
        <Loader2
          data-nav-pending="true"
          className="size-3.5 animate-spin text-accent motion-reduce:animate-none"
          aria-hidden="true"
        />
      ) : (
        <Icon
          className={`size-3.5 ${isActive ? "text-accent" : "text-muted-foreground"}`}
          aria-hidden="true"
        />
      )}
      <span className={pending ? "text-foreground" : undefined}>{label}</span>
    </>
  );
}

function MobileNavItemContent({ icon: Icon, label, isActive }: { icon: LucideIcon; label: string; isActive: boolean }) {
  const { pending } = useLinkStatus();
  const phase = usePendingFeedback({ pending, operationKey: label });
  const showSpinner = phase === "pending";
  return (
    <>
      {showSpinner && <NavPendingBar mobile />}
      {showSpinner ? (
        <Loader2
          data-nav-pending="true"
          className="size-5 animate-spin text-accent motion-reduce:animate-none"
          aria-hidden="true"
        />
      ) : (
        <Icon
          className={`size-5 transition-transform ${
            isActive ? "scale-105 text-accent" : "text-muted-foreground"
          }`}
          aria-hidden="true"
        />
      )}
      <span className={pending ? "font-semibold text-foreground" : undefined}>{label}</span>
    </>
  );
}

export function MainNav({ userEmail }: { userEmail?: string | null }) {
  const pathname = usePathname();
  const { setTheme, resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);
  const {active:shellActive}=useMapShellPresence();

  const toggleTheme = () => {
    const nextTheme = resolvedTheme === "dark" ? "light" : "dark";
    if (!document.startViewTransition) {
      setTheme(nextTheme);
      return;
    }
    document.startViewTransition(() => {
      setTheme(nextTheme);
    });
  };

  return (
    <>
      <header className={`${shellActive || pathname === "/map" || pathname.startsWith("/map/") ? "hidden md:block" : ""} sticky top-0 z-40 w-full border-b border-border bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur-md`}>
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Logo href="/map" />

            <nav className="hidden md:flex md:items-center md:gap-1">
              {navItems.map((item) => {
                const isActive = isNavItemActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={true}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex min-h-[36px] items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs transition-colors ${
                      isActive
                        ? "border border-border bg-surface font-semibold text-foreground shadow-xs"
                        : "font-medium text-muted-foreground hover:bg-surface hover:text-foreground"
                    }`}
                  >
                    <DesktopNavItemContent icon={item.icon} label={item.label} isActive={isActive} />
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {userEmail && (
              <span className="hidden text-xs text-muted-foreground sm:inline-block">
                {userEmail}
              </span>
            )}

            {/* Dark / Light Mode Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground transition-all hover:border-accent/40 hover:text-foreground active:scale-95 cursor-pointer"
              title={mounted && resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              aria-label="Toggle dark mode"
            >
              {mounted ? (
                resolvedTheme === "dark" ? (
                  <Sun className="size-4 text-amber-400" />
                ) : (
                  <Moon className="size-4 text-muted-foreground" />
                )
              ) : (
                <div className="size-4" />
              )}
            </button>

            {/* Sign out button (triggers confirmation modal) */}
            <button
              type="button"
              onClick={() => setIsSignOutModalOpen(true)}
              className="flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-accent/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
              title="Sign out"
            >
              <LogOut className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Confirmation Sign Out Dialog */}
      <SignOutModal
        isOpen={isSignOutModalOpen}
        onClose={() => setIsSignOutModalOpen(false)}
      />
    </>
  );
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <>
    <div data-bottom-nav-space aria-hidden="true" className="h-[calc(3.5rem_+_1px_+_env(safe-area-inset-bottom))] shrink-0 md:hidden" />
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <div className="flex h-14 items-center justify-around px-6">
        {navItems.map((item) => {
          const isActive = isNavItemActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-[44px] min-w-[56px] flex-col items-center justify-center gap-1 rounded-lg py-1 text-[11px] transition-colors touch-manipulation ${
                isActive
                  ? "font-semibold text-foreground"
                  : "font-medium text-muted-foreground hover:text-foreground"
              }`}
            >
              <MobileNavItemContent icon={item.icon} label={item.label} isActive={isActive} />
            </Link>
          );
        })}
      </div>
    </nav>
    </>
  );
}

