"use client";
import type { SheetRoute } from "@/lib/navigation/sheet-routes";
import { format } from "date-fns";
import { Star } from "lucide-react";
import type { VisitWithDetails } from "@/lib/types/visit";
import { parseLocalDate } from "@/lib/utils/visit-date";
import { UserAvatar } from "@/components/ui/user-avatar";
import { PrivatePhoto } from "./private-photo";

interface MemoryCardProps {
  visit: VisitWithDetails;
  onOpen?: (route: SheetRoute) => void;
}

export function MemoryCard({ visit, onOpen }: MemoryCardProps) {
  const { creator, participants, photos, rating, notes, visited_at } = visit;

  let parsedDate: Date;
  try {
    parsedDate = parseLocalDate(visited_at.slice(0, 10));
  } catch {
    parsedDate = new Date(visited_at);
  }
  const dateStr = format(parsedDate, "MMMM d, yyyy");

  return (
    <div className="flex flex-col gap-3 p-4 border border-border rounded-xl bg-card">
      {onOpen && <button className="min-h-11 text-left underline" onClick={() => onOpen({kind:"memory",root:"nearby",entityId:visit.id,circleId:visit.group_id})}>Open memory</button>}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UserAvatar src={creator?.avatar_url} name={creator?.display_name || "Unknown User"} className="border border-border"/>
          <div className="flex flex-col">
            <span className="font-semibold text-sm">{creator?.display_name || "Unknown User"}</span>
            <span className="text-xs text-muted-foreground">{dateStr}</span>
          </div>
        </div>
        
        {rating !== null && rating !== undefined && (
          <div className="flex items-center gap-0.5 px-2 py-1 bg-amber-500/10 rounded-full">
            <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            <span className="text-xs font-medium text-amber-500">{rating}</span>
          </div>
        )}
      </div>

      {notes && (
        <p className="text-sm text-foreground/90">{notes}</p>
      )}

      {photos && photos.length > 0 && (
        <div className="flex gap-2 pb-2 overflow-x-auto snap-x hide-scrollbar">
          {photos.map((photo) => (
            <div key={photo.id} className="relative flex-none w-32 h-32 overflow-hidden border border-border rounded-xl snap-start bg-muted">
              <PrivatePhoto path={photo.storage_path} groupId={visit.group_id} />
            </div>
          ))}
        </div>
      )}

      {participants && participants.length > 0 && (
        <div className="flex items-center gap-2 pt-2 border-t border-border/50">
          <span className="text-xs text-muted-foreground">With</span>
          <div className="flex -space-x-2">
            {participants.map((p) => (
              <UserAvatar key={p.user.id} src={p.user.avatar_url} name={p.user.display_name || "User"} className="size-6 border-2 border-background text-[10px]"/>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
