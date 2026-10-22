import type { SheetRoute } from "@/lib/navigation/sheet-routes";
import type { VisitWithDetails } from "@/lib/types/visit";
import { MemoryCard } from "./memory-card";

interface VisitTimelineProps {
  visits: VisitWithDetails[];
  onOpen?: (route: SheetRoute) => void;
}

export function VisitTimeline({ visits, onOpen }: VisitTimelineProps) {
  if (!visits || visits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed rounded-xl border-border bg-muted/10">
        <p className="text-sm font-medium">No memories yet</p>
        <p className="text-xs text-muted-foreground mt-1">Be the first to log a visit here!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {visits.map((visit) => (
        <MemoryCard key={visit.id} visit={visit} onOpen={onOpen} />
      ))}
    </div>
  );
}
