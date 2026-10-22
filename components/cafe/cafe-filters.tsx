"use client";

import { Star } from "lucide-react";

export type FilterKey = "openNow" | "nearby" | "topRated" | "budget" | "specialty";

type CafeFiltersProps = {
  activeFilters: Set<FilterKey>;
  onToggleFilter: (filter: FilterKey) => void;
  className?: string;
};

const FILTERS_CONFIG: Array<{
  key: FilterKey;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}> = [
  { key: "topRated", label: "Top Rated (4.5+)", icon: Star },
  { key: "nearby", label: "Near Me (< 3km)" },
  { key: "budget", label: "Budget-Friendly ($)" },
];

const SUPPORTED_FILTER_KEYS = new Set<string>(FILTERS_CONFIG.map(({ key }) => key));

export function sanitizeFilterKeys(filters: readonly string[]): FilterKey[] {
  return filters.filter((key): key is FilterKey => SUPPORTED_FILTER_KEYS.has(key));
}

export function CafeFilters({
  activeFilters,
  onToggleFilter,
  className = "",
}: CafeFiltersProps) {
  return (
    <div className={`flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none ${className}`}>
      {FILTERS_CONFIG.map(({ key, label, icon: Icon }) => {
        const isActive = activeFilters.has(key);
        return (
          <button
            key={key}
            type="button"
            onClick={() => onToggleFilter(key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all active:scale-95 cursor-pointer ${
              isActive
                ? "border-accent bg-accent/15 text-accent shadow-xs font-semibold"
                : "border-border/70 bg-surface/70 text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            {Icon && <Icon className="size-3 shrink-0" />}
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
