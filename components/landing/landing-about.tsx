import { NavigationLink as Link } from "@/components/navigation/navigation-feedback";
import { Coffee, Compass, Heart, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const steps = [
  {
    step: "01",
    title: "Find cafés",
    description:
      "Search for cafés or use Near Me to find places using your device location.",
    icon: Compass,
  },
  {
    step: "02",
    title: "Share with your Circle",
    description:
      "Create a private Circle to share cafés you’re interested in, saved places, visits, ratings, photos, and memories with friends.",
    icon: Heart,
  },
  {
    step: "03",
    title: "Keep a personal collection",
    description:
      "Save cafés to your own collections and return to places you want to visit again.",
    icon: Sparkles,
  },
];

export function LandingAbout() {
  return (
    <div className="space-y-16 sm:space-y-24">
      {/* How It Works Section */}
      <section id="how-it-works" className="mx-auto max-w-5xl px-4 py-8 sm:px-6 scroll-mt-20">
        <div className="text-center space-y-2 mb-10">
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            How Cafe360 Works
          </h2>
          <p className="mx-auto max-w-md text-xs sm:text-sm text-muted-foreground">
            Search for cafés, keep a personal collection, and share visits and memories with your Circle.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {steps.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                className="relative flex flex-col justify-between rounded-2xl border border-border bg-surface/60 p-6 shadow-xs transition-all hover:border-accent/40 hover:bg-surface"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-display text-2xl font-extrabold text-[#382215]/30">
                      {item.step}
                    </span>
                    <div className="flex size-8 items-center justify-center rounded-lg bg-background border border-border text-[#382215]">
                      <Icon className="size-4" />
                    </div>
                  </div>
                  <h3 className="font-display text-base font-bold text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* About Section & Mission */}
      <section id="about" className="mx-auto max-w-5xl px-4 pb-12 sm:px-6 scroll-mt-20">
        <div className="rounded-3xl border border-border bg-surface/80 p-8 sm:p-12 text-center space-y-6">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#382215] text-[#FCFBF9]">
            <Coffee className="size-6" />
          </div>

          <div className="max-w-2xl mx-auto space-y-3">
            <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
              A café map for your Circle.
            </h2>
            <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground">
              Cafe360 helps you find cafés, keep a personal collection, and share visits and memories with your private Circle.
            </p>
          </div>

          <div className="pt-2">
            <Button asChild variant="pill" size="lg" className="h-11 px-8 rounded-full bg-[#382215] text-[#FCFBF9] hover:bg-[#4D301E]">
              <Link href="/signup">Join Cafe360 Free</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
