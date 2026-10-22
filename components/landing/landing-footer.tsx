import { NavigationLink as Link } from "@/components/navigation/navigation-feedback";
import { Coffee } from "lucide-react";

// Minimalist footer with brand information, quick navigation links, and copyright.
export function LandingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-background py-8 sm:py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6">

        {/* Brand Info */}
        <div className="flex flex-col items-center sm:items-start gap-2 text-center sm:text-left">
          <Link
            href="/"
            className="flex min-h-[44px] items-center gap-2 text-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-lg"
          >
            <div className="flex size-7 items-center justify-center rounded-lg border border-border bg-surface text-foreground">
              <Coffee className="size-3.5" aria-hidden="true" strokeWidth={2} />
            </div>
            <span className="font-display text-base font-bold tracking-tight">Cafe360</span>
          </Link>
          <p className="text-xs text-muted-foreground">
            Shared café maps & memories for your circle.
          </p>
        </div>

        {/* Quick Links */}
        <nav className="flex flex-wrap items-center justify-center gap-6 text-xs font-medium text-muted-foreground">
          <Link
            href="/login"
            className="flex min-h-[44px] items-center transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="flex min-h-[44px] items-center transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          >
            Create Account
          </Link>
          <Link
            href="/forgot-password"
            className="flex min-h-[44px] items-center transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          >
            Forgot Password
          </Link>
        </nav>


        {/* Copyright */}
        <div className="text-center sm:text-right">
          <p className="text-xs text-muted-foreground">
            &copy; {currentYear} Cafe360. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
