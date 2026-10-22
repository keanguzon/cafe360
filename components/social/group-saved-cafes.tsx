"use client";

import { Coffee } from "lucide-react";
import type { GroupSavedCafe } from "@/lib/types/social";

type GroupSavedCafesProps = {
  saves: GroupSavedCafe[];
};

export function GroupSavedCafesList({ saves }: GroupSavedCafesProps) {
  if (saves.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <Coffee className="size-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No cafés saved to this group yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {saves.map((save) => (
        <div key={save.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-accent/10">
            <Coffee className="size-4 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{save.cafe_name || "Café"}</p>
            {save.cafe_address && (
              <p className="text-xs text-muted-foreground truncate">{save.cafe_address}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
