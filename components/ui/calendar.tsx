"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CalendarProps {
  mode?: "single";
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
  initialFocus?: boolean;
  className?: string;
}

export function Calendar({
  selected,
  onSelect,
  className,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState<Date>(selected || new Date());

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  const monthName = currentMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const days = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    days.push(<div key={`empty-${i}`} className="size-10" />);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const isSelected =
      selected &&
      selected.getDate() === d &&
      selected.getMonth() === month &&
      selected.getFullYear() === year;

    days.push(
      <button
        key={`day-${d}`}
        type="button"
        aria-label={new Date(year, month, d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
        aria-pressed={Boolean(isSelected)}
        onClick={() => onSelect?.(new Date(year, month, d))}
        className={cn(
          "size-10 rounded-lg text-sm font-medium transition-colors flex items-center justify-center cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          isSelected
            ? "bg-accent text-accent-foreground font-bold"
            : "hover:bg-accent/10 hover:text-accent text-foreground"
        )}
      >
        {d}
      </button>
    );
  }

  return (
    <div className={cn("p-3 bg-surface rounded-2xl", className)}>
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs font-bold text-foreground">{monthName}</span>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Previous month"
            onClick={prevMonth}
            className="size-11 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={nextMonth}
            className="size-11 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold text-muted-foreground mb-1">
        <span>Su</span>
        <span>Mo</span>
        <span>Tu</span>
        <span>We</span>
        <span>Th</span>
        <span>Fr</span>
        <span>Sa</span>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">{days}</div>
    </div>
  );
}
