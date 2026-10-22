import { Activity, BookOpen, MapPin, Shuffle } from "lucide-react";

const features = [
  {
    icon: MapPin,
    title: "Search cafés near you",
    description:
      "Search the café map or use Near Me to find places around your device location.",
  },
  {
    icon: Shuffle,
    title: "Share with your Circle",
    description:
      "Create a private Circle to share cafés you’re interested in, places you save, and visits you make with friends.",
  },
  {
    icon: BookOpen,
    title: "Keep a personal collection",
    description:
      "Save cafés to your own collection and return to the places you want to visit again.",
  },
  {
    icon: Activity,
    title: "Share café memories",
    description:
      "Add ratings and photos to café visits, then share those memories with your Circle.",
  },
];

export function LandingFeatureList() {
  return (
    <section id="features" className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 scroll-mt-20">
      <div className="text-center space-y-2 mb-8 sm:mb-10">

        <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Crafted for every coffee ritual.
        </h2>
        <p className="mx-auto max-w-lg text-xs sm:text-sm text-muted-foreground">
          Everything your circle needs to explore, remember, and connect over great coffee.
        </p>
      </div>


      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <div
              key={feature.title}
              className="group flex flex-col rounded-2xl border border-border bg-surface/50 p-6 sm:p-8 transition-colors hover:border-accent/40 hover:bg-surface"
            >
              <div className="mb-5 flex size-10 items-center justify-center rounded-xl border border-border bg-background text-foreground transition-colors group-hover:border-accent/30">
                <Icon className="size-5" aria-hidden="true" strokeWidth={1.75} />
              </div>
              <h3 className="font-display text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
