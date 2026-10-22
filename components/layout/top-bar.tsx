"use client";

import { NavigationLink as Link } from "@/components/navigation/navigation-feedback";
import { Search, User } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { UserAvatar } from "@/components/ui/user-avatar";

export function TopBar({
  userAvatarUrl,
}: {
  userAvatarUrl?: string | null;
}) {
  return (
    <header className="pointer-events-none absolute top-3 inset-x-0 z-30 flex justify-center px-4">
      <div className="pointer-events-auto flex h-12 w-full max-w-lg items-center justify-between gap-3 rounded-full border border-border/80 bg-surface/90 px-3.5 shadow-xl backdrop-blur-md transition-all hover:border-accent/40">
        <Logo href="/map" size="sm" responsiveText={true} />

        {/* Quick Search Action Bar leading to Discover */}
        <Link
          href="/discover"
          className="flex flex-1 items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-accent/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Search className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <span className="truncate">Search cafés, roast types, areas...</span>
        </Link>

        {/* Profile Link */}
        <Link
          href="/profile"
          aria-label="Your Profile"
          className="flex size-8 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-all hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent overflow-hidden"
        >
          <UserAvatar src={userAvatarUrl} name="Your profile" decorative className="size-full bg-surface" fallback={<User className="size-4" aria-hidden="true"/>}/>
        </Link>
      </div>
    </header>
  );
}
