import { LandingHero } from "@/components/landing/landing-hero";
import { LandingFeatureList } from "@/components/landing/landing-feature-list";
import { LandingAbout } from "@/components/landing/landing-about";
import { LandingFooter } from "@/components/landing/landing-footer";

// Minimalist landing page showcasing Cafe360 core features and entry points.
export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground scroll-smooth">
      <main className="flex-1">
        <LandingHero />
        <LandingFeatureList />
        <LandingAbout />
      </main>
      <LandingFooter />
    </div>
  );
}

