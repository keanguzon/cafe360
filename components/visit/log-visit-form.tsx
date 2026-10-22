"use client";

import { refreshPage } from "@/lib/navigation/browser-recovery";
import { ActionFeedback } from "@/components/ui/action-feedback";

import { useEffect, useState, useTransition } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "./star-rating";
import { ParticipantPicker } from "./participant-picker";
import { PhotoUpload } from "./photo-upload";
import { createVisitAction } from "@/lib/actions/visit-actions";
import { formatLocalDate } from "@/lib/utils/visit-date";
import { useCircle } from "@/lib/context/circle-context";
import type { FriendProfile } from "@/lib/types/social";
import type { CafeSearchResult } from "@/lib/types/places";
import { toast } from "sonner";
import { isOnline, OFFLINE_MUTATION_MESSAGE, useOnlineStatus } from "@/lib/hooks/use-online-status";

interface LogVisitFormProps {
  cafe: CafeSearchResult;
  onSuccess: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function LogVisitForm({ cafe, onSuccess, onDirtyChange }: LogVisitFormProps) {
  const online = useOnlineStatus();
  const { accountId, circleMembers, activeCircle, invalidateCircle } = useCircle();
  const [isPending, startTransition] = useTransition();

  const [date, setDate] = useState<Date>(new Date());
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [photoPaths, setPhotoPaths] = useState<string[]>([]);
  const [photosBusy, setPhotosBusy] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const [initialDate] = useState(() => formatLocalDate(new Date()));
  const dirty = !isSubmitted && (formatLocalDate(date) !== initialDate || rating !== null || notes.length > 0 || selectedFriends.length > 0 || photoPaths.length > 0 || photosBusy);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  // Map circle members to participant format
  const friends: FriendProfile[] = circleMembers.map((m) => ({
    id: m.userId,
    username: m.displayName.toLowerCase().replace(/\s+/g, ""),
    display_name: m.displayName,
    avatar_url: m.avatarUrl || null,
  }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline()) { toast.error(OFFLINE_MUTATION_MESSAGE); return; }
    if (photosBusy || isPending) return;
    if (!date) return;
    if (!activeCircle) {
      toast.error("No active circle", { description: "You must select a circle to log a visit." });
      return;
    }

    startTransition(async () => {
      try {
        const result = await createVisitAction({
          cafe_id: cafe.id,
          group_id: activeCircle.id,
          cafe,
          visited_at: formatLocalDate(date),
          rating,
          notes: notes.trim() || undefined,
          participant_ids: selectedFriends,
          photo_paths: photoPaths,
        });

        if (result.success) {
          setIsSubmitted(true);
          onDirtyChange?.(false);
          await invalidateCircle(activeCircle.id).catch(() => {
            toast.error("Visit saved, but Circle data could not refresh");
          });
          toast.success("Visit logged!", {
            description: "Your memory has been saved to Cafe360.",
          });
          onSuccess();
        } else {
          toast.error("Failed to log visit", {
            description: result.error,
          });
        }
      } catch {
        toast.error("Failed to log visit");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">I went to {cafe.name}</h2>
        <p className="text-sm text-muted-foreground">Log your visit, rate the coffee, and share memories.</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">When did you go?</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal h-12",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="w-4 h-4 mr-2" />
                {date ? format(date, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d: Date | undefined) => d && setDate(d)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Rating</label>
          <StarRating rating={rating} onChange={setRating} />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Who were you with?</label>
          <ParticipantPicker 
            friends={friends} 
            selectedIds={selectedFriends} 
            onChange={setSelectedFriends} 
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Add Photos</label>
        <PhotoUpload operationKey={`visit-photo:${accountId}:${activeCircle?.id}:${cafe.id}`} onUploadSuccess={setPhotoPaths} onBusyChange={setPhotosBusy} disabled={isPending || isSubmitted} />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Notes (optional)</label>
          <Textarea 
            placeholder="How was the wifi? Did you try the cold brew?" 
            value={notes}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
            className="resize-none"
            rows={3}
          />
        </div>
      </div>

      {!online && <p role="status" className="text-xs text-muted-foreground">{OFFLINE_MUTATION_MESSAGE}</p>}
      <Button type="submit" className="w-full h-12" disabled={!online || isPending || photosBusy}>
        {isPending ? (
          <>
            <span aria-hidden="true">…</span>
            Saving...
          </>
        ) : (
          "Save Visit"
        )}
      </Button>
    <ActionFeedback onRefresh={onDirtyChange ? refreshPage : undefined} pending={isPending} operationKey={`visit:${accountId}:${activeCircle?.id}:${cafe.id}`} label="Saving visit…" />
      </form>
  );
}
