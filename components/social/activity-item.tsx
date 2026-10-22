"use client";

import { Bookmark, Camera, Coffee, Heart, Star, UserPlus, Users } from "lucide-react";
import type { Activity } from "@/lib/types/social";
import { UserAvatar } from "@/components/ui/user-avatar";

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type ActivityItemProps = {
  activity: Activity;
  compact?: boolean;
};

export function ActivityItem({ activity, compact = false }: ActivityItemProps) {
  const { profile, cafe, group, type, metadata, created_at } = activity;
  const timeAgo = formatRelativeTime(created_at);

  const initials = profile?.display_name
    ? profile.display_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "U";

  const getActionDetails = () => {
    const collection = typeof metadata?.collection === "string" ? metadata.collection : null;

    switch (type) {
      case "save":
        return {
          icon: <Bookmark className="size-3.5 text-amber-400" />,
          bgColor: "bg-amber-500/10",
          text: (
            <span>
              saved <span className="font-semibold text-foreground">{cafe?.name || "a café"}</span>
              {collection && (
                <span className="text-muted-foreground"> to {collection}</span>
              )}
            </span>
          ),
        };
      case "interest":
        return {
          icon: <Heart className="size-3.5 text-accent" />,
          bgColor: "bg-accent/10",
          text: (
            <span>
              is interested in <span className="font-semibold text-foreground">{cafe?.name || "a café"}</span>
            </span>
          ),
        };
      case "visit":
        return {
          icon: <Coffee className="size-3.5 text-accent" />,
          bgColor: "bg-accent/10",
          text: (
            <span>
              visited <span className="font-semibold text-foreground">{cafe?.name || "a café"}</span>
            </span>
          ),
        };
      case "photo":
        return {
          icon: <Camera className="size-3.5 text-sky-400" />,
          bgColor: "bg-sky-500/10",
          text: (
            <span>
              shared a photo from <span className="font-semibold text-foreground">{cafe?.name || "a café"}</span>
            </span>
          ),
        };
      case "rating":
        return {
          icon: <Star className="size-3.5 text-amber-400" />,
          bgColor: "bg-amber-500/10",
          text: (
            <span>
              rated <span className="font-semibold text-foreground">{cafe?.name || "a café"}</span>
            </span>
          ),
        };
      case "join_group":
        return {
          icon: <UserPlus className="size-3.5 text-emerald-400" />,
          bgColor: "bg-emerald-500/10",
          text: (
            <span>
              joined <span className="font-semibold text-foreground">{group?.name || "a group"}</span>
            </span>
          ),
        };
      default:
        return {
          icon: <Users className="size-3.5 text-muted-foreground" />,
          bgColor: "bg-surface",
          text: <span>did an activity</span>,
        };
    }
  };

  const action = getActionDetails();

  return (
    <div className={`flex items-start gap-3 rounded-xl border border-border bg-surface transition-colors hover:border-accent/30 ${compact ? "p-2.5" : "p-3.5"}`}>
      {/* User Avatar */}
      <div className="relative shrink-0">
        <UserAvatar src={profile?.avatar_url} name={profile?.display_name || "User"} fallback={initials}/>
        <div
          className={`absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full border-2 border-surface ${action.bgColor}`}
        >
          {action.icon}
        </div>
      </div>

      {/* Main Activity Content */}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className={`text-xs text-muted-foreground ${compact ? "line-clamp-2 break-words" : ""}`}>
            <span className="font-medium text-foreground">{profile?.display_name || "Someone"}</span>{" "}
            {action.text}
          </p>
          <span className={`shrink-0 text-[10px] ${compact ? "text-muted-foreground" : "text-muted-foreground/70"}`}>{timeAgo}</span>
        </div>

        {/* Optional Context Metadata */}
        {!compact && type === "visit" && typeof metadata?.notes === "string" && (
          <p className="rounded-lg bg-background/50 p-2 text-xs italic text-muted-foreground">
            &ldquo;{String(metadata.notes)}&rdquo;
          </p>
        )}

        {!compact && type === "visit" && typeof metadata?.rating === "number" && (
          <div className="flex items-center gap-1 text-xs font-semibold text-amber-400">
            <Star className="size-3 fill-amber-400 text-amber-400" />
            <span>{Number(metadata.rating).toFixed(1)}</span>
          </div>
        )}

        {!compact && type === "photo" && typeof metadata?.photoUrl === "string" && (
          <div className="mt-2 overflow-hidden rounded-lg border border-border/50 bg-background/40">
            <img
              src={String(metadata.photoUrl)}
              alt="Visit capture"
              className="h-36 w-full object-cover transition-transform duration-300 hover:scale-105"
              loading="lazy"
            />
          </div>
        )}

        {!compact && cafe?.address && (
          <p className="text-[10px] text-muted-foreground/60 truncate">{cafe.address}</p>
        )}
      </div>
    </div>
  );
}
