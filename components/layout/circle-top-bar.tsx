"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavigationLink as Link } from "@/components/navigation/navigation-feedback";
import {
  ArrowLeft,
  ChevronDown,
  Loader2,
  Newspaper,
  Search,
  Settings,
  X,
} from "lucide-react";
import { useCircle } from "@/lib/context/circle-context";
import { CircleSwitcherDialog } from "@/components/social/circle-switcher-dialog";
import { cn } from "@/lib/utils";

export interface CircleTopBarProps {
  userAvatarUrl?: string | null;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onSearchSubmit?: (query: string) => void;
  isSearching?: boolean;
  cafeCount?: number;
  onActivityOpen?: () => void;
  onSettingsOpen?: () => void;
  onCircleOpen?: () => void;
  beforeCircleOpen?: () => boolean;
  rightAction?: ReactNode;
}

export function CircleTopBar({
  searchQuery = "",
  onSearchChange,
  onSearchSubmit,
  isSearching = false,
  cafeCount = 0,
  onActivityOpen, onSettingsOpen, onCircleOpen, beforeCircleOpen, rightAction,
}: CircleTopBarProps) {
  const { activeCircle, membershipsResolved } = useCircle();
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Auto focus input when search mode opens
  useEffect(() => {
    if (isSearchOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [isSearchOpen]);

  // Handle escape key to close search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isSearchOpen) {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSearchOpen]);

  return (
    <>
      <header className="pointer-events-none absolute top-[calc(env(safe-area-inset-top)_+_0.75rem)] inset-x-0 z-30 flex justify-center px-3 sm:px-4">
        <div
          className={cn(
            "pointer-events-auto relative flex h-13 w-full max-w-lg items-center rounded-full border bg-surface/95 px-3 shadow-xl backdrop-blur-md transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
            isSearchOpen
              ? "border-accent/60 ring-2 ring-accent/25 bg-surface/98"
              : "border-border/80"
          )}
        >
          {/* Layer 1: Normal Top Bar Content */}
          <div
            className={cn(
              "flex w-full items-center justify-between gap-2 transition-all duration-250 ease-out",
              isSearchOpen
                ? "opacity-0 scale-95 pointer-events-none translate-y-1 invisible absolute inset-x-3"
                : "opacity-100 scale-100 pointer-events-auto translate-y-0 visible"
            )}
          >
            {/* Left: Circle Settings & Search Button */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Link
                href="/settings"
                onClick={event => { if (onSettingsOpen) { event.preventDefault(); onSettingsOpen(); } }}
                aria-label="Settings"
                title="Settings"
                className="relative flex size-9 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-colors hover:border-accent hover:text-accent cursor-pointer"
              >
                <Settings className="size-4.5" />
              </Link>
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                title="Search cafés"
                className="flex size-9 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-all hover:border-accent hover:text-accent active:scale-95 cursor-pointer"
              >
                <Search className="size-4" />
              </button>
            </div>

            {/* Center: Active Circle Dropdown Pill */}
            <button
              onClick={() => {if(beforeCircleOpen&&!beforeCircleOpen())return;if(onCircleOpen)onCircleOpen();else setIsSwitcherOpen(true);}}
              className="flex items-center gap-1.5 max-w-[140px] sm:max-w-[190px] rounded-full border border-border/80 bg-background/80 px-3.5 py-1.5 text-xs font-semibold text-foreground shadow-sm transition-all hover:border-accent hover:bg-background cursor-pointer"
            >
              <span className="truncate" aria-busy={!membershipsResolved}>{activeCircle ? activeCircle.name : !membershipsResolved ? "Loading Circle…" : "Select Circle"}</span>
              <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
            </button>

            {/* Right: Activity Feed */}
            <div className="flex items-center gap-1.5 shrink-0">
              {rightAction ?? <button
                onClick={onActivityOpen}
                title="Activity Feed"
                aria-label="Activity Feed"
                className="flex size-9 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-colors hover:border-accent hover:text-accent cursor-pointer"
              >
                <Newspaper className="size-4" />
              </button>}
            </div>
          </div>

          {/* Layer 2: Expanded Search Form Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSearchSubmit?.(searchQuery);
            }}
            className={cn(
              "flex w-full items-center gap-2.5 transition-all duration-250 ease-out",
              isSearchOpen
                ? "opacity-100 scale-100 pointer-events-auto translate-y-0 visible"
                : "opacity-0 scale-95 pointer-events-none -translate-y-1 invisible absolute inset-x-3"
            )}
          >
            {/* Back / Close button */}
            <button
              type="button"
              onClick={() => setIsSearchOpen(false)}
              title="Close search"
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors cursor-pointer"
            >
              <ArrowLeft className="size-4.5" />
            </button>

            {/* Search Input */}
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Search cafés, matcha, roasteries..."
              className="w-full bg-transparent text-base text-foreground placeholder:text-muted-foreground outline-none font-medium"
            />

            {/* Spinner indicator when searching */}
            {isSearching && (
              <Loader2 className="size-4 shrink-0 animate-spin text-accent" />
            )}

            {/* Clear Query button */}
            {searchQuery && !isSearching && (
              <button
                type="button"
                onClick={() => {
                  onSearchChange?.("");
                  onSearchSubmit?.("");
                }}
                className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors cursor-pointer"
                title="Clear search"
              >
                <X className="size-4" />
              </button>
            )}

            {/* Results count badge */}
            {cafeCount > 0 && !isSearching && (
              <span className="shrink-0 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-surface-elevated text-muted-foreground border border-border/50">
                {cafeCount} {cafeCount === 1 ? "spot" : "spots"}
              </span>
            )}

            {/* Search Submit button */}
            <button
              type="submit"
              title="Search"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-sm hover:opacity-90 active:scale-95 transition-all cursor-pointer"
            >
              <Search className="size-3.5" />
            </button>
          </form>
        </div>
      </header>

      <CircleSwitcherDialog isOpen={isSwitcherOpen} onClose={() => setIsSwitcherOpen(false)} />
    </>
  );
}
