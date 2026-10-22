"use client";

import { useEffect, useRef, useState } from "react";
import { Layers, Minus, Moon, Plus, Sun, Trees } from "lucide-react";

import type { MapStyleKey } from "@/lib/services/map-service";

type MapControlsProps = {
  currentStyle: MapStyleKey;
  onStyleChange: (style: MapStyleKey) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
};

const STYLES_CONFIG: Array<{
  icon: typeof Moon;
  key: MapStyleKey;
  label: string;
}> = [
  { key: "dark", label: "Espresso Dark", icon: Moon },
  { key: "streets", label: "Street Map", icon: Layers },
  { key: "light", label: "Warm Light", icon: Sun },
  { key: "outdoors", label: "Outdoors", icon: Trees },
];

export function MapControls({
  currentStyle,
  onStyleChange,
  onZoomIn,
  onZoomOut,
}: MapControlsProps) {
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close style menu on outside click
  useEffect(() => {
    if (!styleMenuOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setStyleMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [styleMenuOpen]);

  return (
    <div ref={menuRef} className="relative flex flex-col items-end gap-2">
      {/* Style selector dropdown */}
      {styleMenuOpen && (
        <div
          role="menu"
          aria-label="Map style selection"
          className="mb-1 w-44 space-y-1 rounded-xl border border-border bg-surface/95 p-1.5 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
        >
          {STYLES_CONFIG.map(({ key, label, icon: Icon }) => {
            const isSelected = currentStyle === key;
            return (
              <button
                key={key}
                type="button"
                role="menuitem"
                onClick={() => {
                  onStyleChange(key);
                  setStyleMenuOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-accent/15 text-accent font-semibold"
                    : "text-foreground hover:bg-background/80 hover:text-accent"
                }`}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Style toggle button */}
      <button
        type="button"
        onClick={() => setStyleMenuOpen((prev) => !prev)}
        aria-label="Toggle map style"
        aria-expanded={styleMenuOpen}
        title="Map styles"
        className="flex size-11 items-center justify-center rounded-xl border border-border bg-surface/90 text-foreground shadow-lg backdrop-blur-md transition-all duration-200 hover:border-accent hover:bg-surface hover:text-accent active:scale-95 cursor-pointer"
      >
        <Layers className="size-5" aria-hidden="true" />
      </button>

      {/* Zoom controls cluster */}
      <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface/90 shadow-lg backdrop-blur-md">
        <button
          type="button"
          onClick={onZoomIn}
          aria-label="Zoom in"
          title="Zoom in"
          className="flex size-11 items-center justify-center text-foreground transition-colors hover:bg-surface hover:text-accent active:scale-95 cursor-pointer border-b border-border/70"
        >
          <Plus className="size-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onZoomOut}
          aria-label="Zoom out"
          title="Zoom out"
          className="flex size-11 items-center justify-center text-foreground transition-colors hover:bg-surface hover:text-accent active:scale-95 cursor-pointer"
        >
          <Minus className="size-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
