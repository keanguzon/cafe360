"use client";

import { Loader2, Search, X } from "lucide-react";

type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isLoading?: boolean;
  className?: string;
};

export function SearchBar({
  value,
  onChange,
  placeholder = "Search cafés, Starbucks, roasteries, areas...",
  isLoading = false,
  className = "",
}: SearchBarProps) {
  const handleClear = () => {
    onChange("");
  };

  return (
    <div className={`relative flex w-full items-center ${className}`}>
      <div className="pointer-events-none absolute left-3.5 flex items-center text-muted-foreground">
        {isLoading ? (
          <Loader2 className="size-4 animate-spin text-accent" />
        ) : (
          <Search className="size-4" />
        )}
      </div>

      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Search cafés"
        className="h-11 w-full rounded-2xl border border-border/80 bg-surface/90 pr-10 pl-10 text-xs text-foreground placeholder:text-muted-foreground backdrop-blur-md transition-colors focus:border-accent focus:bg-surface focus:outline-none"
      />

      {value && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute right-3 flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground active:scale-95 cursor-pointer"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
