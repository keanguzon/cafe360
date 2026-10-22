"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";
import { ReadFeedback } from "@/components/ui/read-feedback";

import { useEffect, useRef, useState, useTransition } from "react";
import { Clock, Plus, Edit2, Check } from "lucide-react";
import { useCircle } from "@/lib/context/circle-context";
import {
  getCircleCafeHoursAction,
  saveCircleCafeHoursAction,
} from "@/lib/actions/cafe-hours-actions";
import { getDayName, type CafeHoursEntry } from "@/lib/utils/cafe-hours";
import type { CafeSearchResult } from "@/lib/types/places";
import { toast } from "sonner";
import { isOnline, OFFLINE_MUTATION_MESSAGE, useOnlineStatus } from "@/lib/hooks/use-online-status";

interface CafeHoursSectionProps {
  cafe: CafeSearchResult;
  isOpen?: boolean;
  onHoursChange?: (hours: CafeHoursEntry[]) => void;
  onHoursError?: (error: string | null) => void;
}

const DEFAULT_DAYS = [1, 2, 3, 4, 5, 6, 0].map((day_of_week) => ({
  day_of_week, open_time: "", close_time: "", is_closed: false,
}));

export function CafeHoursSection({ cafe, isOpen = true, onHoursChange, onHoursError }: CafeHoursSectionProps) {
  const online = useOnlineStatus();
  const { accountId, activeCircle } = useCircle();
  const [hours, setHours] = useState<CafeHoursEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formHours, setFormHours] = useState(DEFAULT_DAYS);
  const [isPending, startTransition] = useTransition();
  const contextKey = `${accountId}:${activeCircle?.id ?? ""}:${cafe.id}`;
  const latestContext = useRef(contextKey);
  useEffect(() => { latestContext.current = contextKey; }, [contextKey]);

  useEffect(() => {
    let cancelled = false;
    async function loadHours() {
      setHours([]);
      setFormHours(DEFAULT_DAYS);
      setLoadError(null);
      setIsEditing(false);
      if (!isOpen || !activeCircle?.id || !cafe?.id) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const data = await getCircleCafeHoursAction(activeCircle.id, cafe.id);
        if (cancelled) return;
        setHours(data);
        onHoursError?.(null);
        onHoursChange?.(data);
        setFormHours(DEFAULT_DAYS.map((day) => {
          const saved = data.find((item) => item.day_of_week === day.day_of_week);
          return saved ? {
            day_of_week: day.day_of_week,
            open_time: saved.open_time?.slice(0, 5) ?? "",
            close_time: saved.close_time?.slice(0, 5) ?? "",
            is_closed: saved.is_closed,
          } : day;
        }));
      } catch {
        if (!cancelled) {
          setLoadError("Could not load Circle hours");
          onHoursChange?.([]);
          onHoursError?.("Hours unavailable");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void loadHours();
    return () => { cancelled = true; };
  }, [activeCircle?.id, cafe?.id, isOpen, onHoursChange, onHoursError]);

  const handleSaveHours = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline()) { toast.error(OFFLINE_MUTATION_MESSAGE); return; }
    if (isPending || !activeCircle) return;
    const savedContext = contextKey;

    startTransition(async () => {
      try {
        const res = await saveCircleCafeHoursAction(activeCircle.id, cafe, formHours);
        if (latestContext.current !== savedContext) return;
        if (res.success) {
          toast.success(`Hours saved for ${activeCircle.name}!`);
          setIsEditing(false);
          const data = await getCircleCafeHoursAction(activeCircle.id, cafe.id);
          if (latestContext.current === savedContext) {
            setHours(data);
            onHoursChange?.(data);
          }
        } else {
          toast.error(res.error || "Failed to save hours");
        }
      } catch {
        if (latestContext.current === savedContext) toast.error("Could not refresh Circle hours");
      }
    });
  };

  const handleTimeChange = (
    dayIndex: number,
    field: "open_time" | "close_time" | "is_closed",
    value: string | boolean
  ) => {
    setFormHours((prev) => {
      const copy = [...prev];
      copy[dayIndex] = { ...copy[dayIndex], [field]: value };
      return copy;
    });
  };

  // Format time (e.g. "08:00" -> "8:00 AM")
  const formatTime = (timeStr: string) => {
    const [hStr, mStr] = timeStr.split(":");
    const h = parseInt(hStr, 10);
    const m = mStr || "00";
    if (isNaN(h)) return timeStr;
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
  };

  const timezone = hours[0]?.timezone || "Asia/Manila";
  let todayName: string;
  try {
    todayName = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long" }).format(new Date());
  } catch {
    todayName = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", weekday: "long" }).format(new Date());
  }

  return (
    <div className="rounded-2xl border border-border/80 bg-background/60 p-4 space-y-3 text-xs">
      <ActionFeedback pending={isPending} operationKey={`hours:${contextKey}`} label="Saving hours…" />
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-foreground flex items-center gap-2">
          <Clock className="size-4 text-accent" />
          <span>Hours & Information</span>
        </h4>
        {activeCircle && !isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-[11px] font-semibold text-accent flex items-center gap-1 hover:opacity-80 transition-opacity cursor-pointer"
          >
            {hours.length > 0 ? (
              <>
                <Edit2 className="size-3" />
                <span>Edit</span>
              </>
            ) : (
              <>
                <Plus className="size-3" />
                <span>Add for Circle</span>
              </>
            )}
          </button>
        )}
      </div>

      {isLoading ? (
        <ReadFeedback pending operationKey={`hours-read:${contextKey}`} label="Loading hours…" />
      ) : loadError ? (
        <div role="alert" className="py-2 text-rose-400">{loadError}</div>
      ) : isEditing ? (
        <form onSubmit={handleSaveHours} className="space-y-2.5 pt-1">
          <p className="text-[11px] text-muted-foreground">
            Set operating hours for <span className="font-semibold text-foreground">{activeCircle?.name}</span>:
          </p>
          <p className="text-[11px] text-muted-foreground">
            Times use the café timezone. If unknown, Asia/Manila is assumed for this Philippines release.
            Mark a day closed or enter both times.
          </p>
          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            {formHours.map((item, idx) => (
              <div
                key={item.day_of_week}
                className="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-surface-elevated/40 border border-border/40 text-xs"
              >
                <span className="font-medium text-foreground w-20 shrink-0">
                  {getDayName(item.day_of_week).slice(0, 3)}
                </span>
                <label className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.is_closed}
                    onChange={(e) => handleTimeChange(idx, "is_closed", e.target.checked)}
                    className="rounded border-border"
                  />
                  <span>Closed</span>
                </label>
                {!item.is_closed && (
                  <div className="flex items-center gap-1 min-w-0">
                    <input
                      type="time"
                      value={item.open_time}
                      onChange={(e) => handleTimeChange(idx, "open_time", e.target.value)}
                      className="px-1.5 py-0.5 rounded-md border border-border bg-background text-[11px] text-foreground focus:outline-none focus:border-accent"
                    />
                    <span className="text-muted-foreground text-[10px]">–</span>
                    <input
                      type="time"
                      value={item.close_time}
                      onChange={(e) => handleTimeChange(idx, "close_time", e.target.value)}
                      className="px-1.5 py-0.5 rounded-md border border-border bg-background text-[11px] text-foreground focus:outline-none focus:border-accent"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {!online && <p role="status" className="text-xs text-muted-foreground">{OFFLINE_MUTATION_MESSAGE}</p>}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={!online || isPending}
              className="flex-1 h-8 rounded-xl bg-accent text-accent-foreground text-xs font-bold flex items-center justify-center gap-1.5 hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              <Check className="size-3.5" />
              <span>Save Hours</span>
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-3 h-8 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Cancel
            </button>
          </div>

      </form>
      ) : hours.length > 0 ? (
        <div className="space-y-1 text-muted-foreground pt-1">
          {hours.map((h) => {
            const isToday = getDayName(h.day_of_week) === todayName;
            return (
              <div
                key={h.id}
                className={`flex justify-between py-1 px-2 rounded-lg transition-colors ${
                  isToday ? "bg-accent/10 text-foreground font-semibold" : ""
                }`}
              >
                <span>
                  {getDayName(h.day_of_week)} {isToday ? "(Today)" : ""}
                </span>
                <span>
                  {h.is_closed
                    ? "Closed"
                    : h.open_time && h.close_time
                      ? `${formatTime(h.open_time)} – ${formatTime(h.close_time)}`
                      : "Hours unknown"}
                </span>
              </div>
            );
          })}
          <p className="text-[10px] text-muted-foreground/70 pt-1 text-right">
            Added by {activeCircle?.name || "circle"} members
          </p>
        </div>
      ) : (
        <div className="py-2 text-center text-muted-foreground space-y-1">
          <p className="text-xs">No hours listed yet for this café.</p>
          {activeCircle && (
            <p className="text-[11px] text-accent/80">
              Tap &ldquo;Add for Circle&rdquo; to share operating hours with your group.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
