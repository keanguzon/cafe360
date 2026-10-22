import { Calendar, User } from "lucide-react";
import { UserAvatar } from "@/components/ui/user-avatar";

import type { Profile } from "@/lib/types/profile";

export function ProfileHeader({
  profile,
  isOwnProfile = false,
}: {
  profile: Profile;
  isOwnProfile?: boolean;
}) {
  const memberSince = new Date(profile.created_at).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });

  return (
    <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-left sm:gap-6">
      <div className="relative size-24 shrink-0 overflow-hidden rounded-full border-2 border-accent/40 bg-surface shadow-md">
        <UserAvatar src={profile.avatar_url} name={profile.display_name} className="size-full bg-surface" fallback={<User className="size-12" aria-hidden="true" strokeWidth={1.5}/>}/>
      </div>

      <div className="flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {profile.display_name}
          </h1>
          {isOwnProfile && (
            <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
              You
            </span>
          )}
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          @{profile.username}
        </p>

        {profile.bio && (
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-foreground/90">
            {profile.bio}
          </p>
        )}

        <div className="flex items-center justify-center gap-1.5 pt-1 text-xs text-muted-foreground sm:justify-start">
          <Calendar className="size-3.5" aria-hidden="true" />
          <span>Joined {memberSince}</span>
        </div>
      </div>
    </div>
  );
}
