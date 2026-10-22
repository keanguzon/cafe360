"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";

import { useEffect, useState } from "react";
import { Coffee, MapPin, Star, X, Check } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useCircle } from "@/lib/context/circle-context";
import { createVisitAction } from "@/lib/actions/visit-actions";
import { formatManilaDate } from "@/lib/utils/visit-date";
import type { CafeSearchResult } from "@/lib/types/places";
import { toast } from "sonner";
import { useModalFocus } from "@/lib/hooks/use-modal-focus";
import { isOnline, OFFLINE_MUTATION_MESSAGE, useOnlineStatus } from "@/lib/hooks/use-online-status";

interface CheckInModalProps {
  onChooseCafe?: (cafe: CafeSearchResult) => void;
  isOpen: boolean;
  onClose: () => void;
  nearbyCafes: CafeSearchResult[];
  userCoordinates: [number, number] | null;
}

export function CheckInModal({
  isOpen,
  onClose,
  nearbyCafes,
  onChooseCafe,
}: CheckInModalProps) {
  const online = useOnlineStatus();
  const { ref: dialogRef } = useModalFocus<HTMLDivElement>(isOpen, onClose);
  const { accountId, activeCircle, invalidateCircle } = useCircle();
  const [selectedCafe, setSelectedCafe] = useState<CafeSearchResult | null>(null);
  const [rating, setRating] = useState<number>(5);
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Lock body scroll when modal is open to prevent moving the map underneath
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline()) { toast.error(OFFLINE_MUTATION_MESSAGE); return; }
    if (isSubmitting || !selectedCafe || !activeCircle) return;

    setIsSubmitting(true);
    try {
      const res = await createVisitAction({
        cafe_id: selectedCafe.id,
        cafe: selectedCafe,
        group_id: activeCircle.id,
        visited_at: formatManilaDate(new Date()),
        rating,
        notes: notes.trim() || undefined,
      });

      if (res.success) {
        toast.success(`Checked in at ${selectedCafe.name}! Added to ${activeCircle.name}`);
        await invalidateCircle(activeCircle.id).catch(() => {
          toast.error("Visit saved, but Circle data could not refresh");
        });
        onClose();
        setSelectedCafe(null);
        setNotes("");
      } else {
        toast.error(res.error || "Failed to check in");
      }
    } catch {
      toast.error("Failed to check in");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm select-none"
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="check-in-modal-title"
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="relative w-full sm:max-w-md max-h-[85dvh] flex flex-col bg-surface border-t sm:border border-border rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4 touch-pan-y"
          >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-full bg-accent/15 flex items-center justify-center text-accent">
              <MapPin className="size-5" />
            </div>
            <div>
              <h2 id="check-in-modal-title" className="text-lg font-display font-bold text-foreground">
                Circle Check-in
              </h2>
              <p className="text-xs text-muted-foreground">
                Share with <span className="font-semibold text-foreground">{activeCircle?.name || "your circle"}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close check-in"
            onClick={onClose}
            className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {!selectedCafe ? (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="space-y-3 overflow-y-auto max-h-[50dvh] pr-1 overscroll-contain"
          >
            <p className="text-xs font-medium text-muted-foreground">
              Select a café nearby:
            </p>
            {nearbyCafes.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <Coffee className="size-8 mx-auto text-muted-foreground/50 animate-bounce" />
                <p className="text-xs text-muted-foreground">No cafes found nearby. Move closer to a cafe or search manually.</p>
              </div>
            ) : (
              nearbyCafes.map((cafe) => (
                <button
                  type="button"
                  key={cafe.id}
                  onClick={() => { if(onChooseCafe) { onChooseCafe(cafe); onClose(); } else setSelectedCafe(cafe); }}
                  className="w-full text-left flex items-center justify-between p-3 rounded-2xl bg-surface-elevated/40 border border-border/50 hover:border-accent/50 hover:bg-surface-elevated cursor-pointer transition-all active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0 pr-3">
                    <div className="size-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent shrink-0">
                      <Coffee className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-foreground truncate">{cafe.name}</h4>
                      <p className="text-xs text-muted-foreground truncate">{cafe.address || "Nearby"}</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-accent px-3 py-1.5 rounded-full bg-accent/10 shrink-0 whitespace-nowrap">
                    Select
                  </span>
                </button>
              ))
            )}
          </div>
        ) : (
          <form onSubmit={handleCheckIn} className="space-y-4">
            <div className="p-3 rounded-2xl bg-accent/10 border border-accent/30 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Coffee className="size-5 text-accent" />
                <div>
                  <h4 className="text-sm font-bold text-foreground">{selectedCafe.name}</h4>
                  <p className="text-[11px] text-muted-foreground">{selectedCafe.address}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCafe(null)}
                className="text-xs text-accent underline font-medium"
              >
                Change
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Circle Rating</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    aria-label={`Rate ${star} out of 5`}
                    aria-pressed={star === rating}
                    onClick={() => setRating(star)}
                    className="p-2 transition-transform active:scale-125"
                  >
                    <Star
                      className={`size-6 ${
                        star <= rating
                          ? "text-amber-400 fill-amber-400"
                          : "text-muted-foreground/30"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Notes for Circle (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What did you order? How's the vibe?"
                rows={2}
                maxLength={200}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={!online || isSubmitting}
              className="w-full h-12 rounded-2xl bg-accent text-accent-foreground font-bold text-sm shadow-lg shadow-accent/25 flex items-center justify-center gap-2 hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <span aria-hidden="true">…</span>
              ) : (
                <Check className="size-4" />
              )}
              {isSubmitting ? "Checking In..." : "Confirm Check-in"}
            </button>
            {!online && <p role="status" className="text-xs text-muted-foreground">{OFFLINE_MUTATION_MESSAGE}</p>}
          <ActionFeedback pending={isSubmitting} operationKey={`check-in:${accountId}:${activeCircle?.id}:${selectedCafe?.id}`} label="Saving check-in…" />
      </form>
        )}

        {/* Solid bottom overdrag skirt */}
        <div className="absolute top-[calc(100%-1px)] inset-x-0 h-[100vh] bg-surface sm:hidden pointer-events-none" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
