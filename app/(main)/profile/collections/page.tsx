import type { Metadata } from "next";
import { NavigationLink as Link } from "@/components/navigation/navigation-feedback";
import { ArrowLeft, Compass } from "lucide-react";
import { CollectionsContent } from "@/components/profile/collections-content";

export const metadata: Metadata = {
  title: "Your Collections — Cafe360",
  description: "Organize and browse your saved café spots and wishlist.",
};

export default function CollectionsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 pt-6 pb-28 sm:px-6 sm:py-10">
      {/* Navigation & Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/profile"
            className="flex size-9 items-center justify-center rounded-xl border border-border bg-surface text-muted-foreground hover:border-accent hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Saved Collections
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your saved cafés, wishlists, and curated spots
            </p>
          </div>
        </div>

        <Link
          href="/discover"
          className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 px-3.5 py-2 text-xs font-semibold text-accent hover:bg-accent/20 transition-colors"
        >
          <Compass className="size-4" />
          Explore Cafés
        </Link>
      </div>

      <CollectionsContent />
    </div>
  );
}
