"use client";

import { NavigationLink as Link } from "@/components/navigation/navigation-feedback";
import { Users } from "lucide-react";
import type { GroupWithMembers } from "@/lib/types/social";

type GroupCardProps = {
  group: Pick<GroupWithMembers, "id" | "name" | "description" | "member_count">;
};

export function GroupCard({ group }: GroupCardProps) {
  const initial = group.name.charAt(0).toUpperCase();

  return (
    <Link
      href={`/circles/${group.id}`}
      className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 transition-colors hover:border-accent/30"
    >
      <div className="flex size-11 items-center justify-center rounded-full bg-gradient-to-br from-accent/20 to-accent/5 text-lg font-bold text-accent">
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{group.name}</p>
        {group.description && (
          <p className="text-xs text-muted-foreground truncate">{group.description}</p>
        )}
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Users className="size-3.5" />
        <span>{group.member_count}</span>
      </div>
    </Link>
  );
}
