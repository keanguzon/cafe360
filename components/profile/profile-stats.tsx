import { NavigationLink as Link } from "@/components/navigation/navigation-feedback";
import { Bookmark, Camera, Coffee, Users } from "lucide-react";
import type { ProfileStats } from "@/lib/types/profile";

export function ProfileStatsSection({ stats }: { stats: ProfileStats }) {
  const statItems = [
    {
      label: "Visits",
      value: stats.visitsCount,
      icon: Coffee,
      description: "Logged café stops",
      href: undefined,
    },
    {
      label: "Saved",
      value: stats.favoritesCount,
      icon: Bookmark,
      description: "Bookmarked spots",
      href: "/profile/collections",
    },
    {
      label: "Memories",
      value: stats.memoriesCount,
      icon: Camera,
      description: "Photos shared",
      href: undefined,
    },
    {
      label: "Circles",
      value: stats.groupsCount,
      icon: Users,
      description: "Friend groups",
      href: "/circles",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      {statItems.map((item) => {
        const Icon = item.icon;
        const CardContent = (
          <div
            className={`flex h-full flex-col justify-between rounded-2xl border border-border bg-surface p-4 transition-all ${
              item.href
                ? "hover:border-accent hover:bg-surface/90 hover:shadow-md cursor-pointer active:scale-98"
                : "hover:border-accent/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {item.label}
              </span>
              <Icon className="size-4 text-accent/80" aria-hidden="true" strokeWidth={1.75} />
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {item.value}
              </span>
              <p className="mt-0.5 text-[11px] text-muted-foreground truncate">
                {item.description}
              </p>
            </div>
          </div>
        );

        return item.href ? (
          <Link key={item.label} href={item.href} className="block">
            {CardContent}
          </Link>
        ) : (
          <div key={item.label}>{CardContent}</div>
        );
      })}
    </div>
  );
}
