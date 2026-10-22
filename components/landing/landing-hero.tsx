"use client";

import { useState } from "react";
import { NavigationLink as Link } from "@/components/navigation/navigation-feedback";
import { Check, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhoneMapMockup } from "./phone-map-mockup";
import { Logo } from "@/components/ui/logo";
import { SmartCtaButton } from "./smart-cta-button";


const navLinks = [
  { name: "Features", href: "#features" },
  { name: "How It Works", href: "#how-it-works" },
  { name: "About", href: "#about" },
];

export function LandingHero() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Desktop Floating Pill Navbar (Matching Screenshot 1) */}
      <header className="fixed top-4 inset-x-0 z-50 hidden md:flex justify-center px-4">
        <nav className="flex items-center justify-between rounded-full border border-border/80 bg-surface/90 px-6 py-2 shadow-sm backdrop-blur-md max-w-4xl w-full">
          {/* Logo */}
          <Logo textClassName="hidden sm:inline-block" />

          {/* Center Links (Public Info Only) */}
          <ul className="flex items-center gap-8 text-xs font-medium text-muted-foreground">
            {navLinks.map((item) => (
              <li key={item.name}>
                <a
                  href={item.href}
                  className="transition-colors hover:text-foreground"
                >
                  {item.name}
                </a>
              </li>
            ))}
          </ul>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="inline-flex items-center text-xs font-semibold text-foreground transition-colors hover:text-accent"
            >
              Sign In
            </Link>
            <Button asChild variant="pill" className="h-9 px-5 text-xs font-bold shadow-xs">
              <Link href="/signup">Get Started</Link>
            </Button>
          </div>
        </nav>
      </header>


      {/* Mobile Floating Pill Navbar (Matching Screenshot 2 & 3) */}
      <div className="md:hidden">
        <header className="fixed top-3 inset-x-3 z-50">
          {/* Top Floating Pill Header */}
          <div className="flex h-11 items-center justify-between rounded-full border border-border/80 bg-surface/90 px-4 shadow-sm backdrop-blur-md">
            <Logo onClick={() => setMobileMenuOpen(false)} iconClassName="size-6.5" textClassName="text-sm" />

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Close Menu" : "Open Menu"}
              className="flex size-8 items-center justify-center text-foreground transition-transform active:scale-90 cursor-pointer"
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>

          {/* Clean Dropdown Card (Slides smoothly beneath the pill header) */}
          {mobileMenuOpen && (
            <div className="mt-2 rounded-[24px] border border-border bg-surface p-5 shadow-2xl animate-in fade-in-0 slide-in-from-top-2 duration-200">
              <ul className="space-y-3.5 pb-4 text-sm font-semibold text-foreground">
                {navLinks.map((item) => (
                  <li key={item.name}>
                    <a
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="block py-1 text-foreground transition-colors hover:text-accent"
                    >
                      {item.name}
                    </a>
                  </li>
                ))}
                <li className="border-t border-border pt-3">
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block py-1 text-foreground transition-colors hover:text-accent"
                  >
                    Sign In
                  </Link>
                </li>
              </ul>

              {/* Bottom Full-Width Deep Roast Pill CTA */}
              <Button
                asChild
                variant="pill"
                className="w-full h-11 rounded-full font-bold text-sm shadow-xs active:scale-95 transition-transform"
              >
                <Link href="/signup" onClick={() => setMobileMenuOpen(false)}>
                  Get Started
                </Link>
              </Button>
            </div>
          )}
        </header>
      </div>






      {/* Hero Section */}
      <section className="relative overflow-hidden bg-background px-4 pt-20 pb-8 sm:px-6 sm:pt-24 sm:pb-12 lg:pt-28 lg:pb-16">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-12">
            {/* Left Content Column */}
            <div className="space-y-5 text-center lg:col-span-7 lg:text-left">
              <h1 className="font-display text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl md:text-6xl lg:leading-[1.1]">
                The shared café map for your circle.
              </h1>

              <p className="mx-auto max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base lg:mx-0">
                Search for cafés or use Near Me with your device location. Keep a personal collection and share visits, ratings, photos, and memories with your private Circle.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 pt-1">
                <SmartCtaButton />
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto h-12 px-7 rounded-full border-border bg-surface font-medium hover:bg-surface/80"
                >
                  <Link href="/login">Sign In</Link>
                </Button>
              </div>

              {/* Benefits Checklist */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-2 pt-2 text-xs font-medium text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Check className="size-3.5 text-foreground" />
                  <span>Private Circle map</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="size-3.5 text-foreground" />
                  <span>Search &amp; Near Me</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="size-3.5 text-foreground" />
                  <span>100% Free</span>
                </div>
              </div>
            </div>

            {/* Right Phone Mockup Column */}
            <div className="lg:col-span-5 flex justify-center lg:justify-end">
              <PhoneMapMockup />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}


