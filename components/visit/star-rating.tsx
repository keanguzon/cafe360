"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating: number | null;
  onChange: (rating: number) => void;
  readOnly?: boolean;
}

export function StarRating({ rating, onChange, readOnly = false }: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const displayRating = hovered !== null ? hovered : (rating || 0);

  return (
    <div className="flex items-center space-x-1" onMouseLeave={() => !readOnly && setHovered(null)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          aria-label={`Rate ${star} out of 5 stars`}
          aria-pressed={rating === star}
          className={cn(
            "p-1.5 transition-colors rounded-md focus:outline-none focus:ring-2 focus:ring-accent",
            readOnly ? "cursor-default" : "cursor-pointer hover:scale-110"
          )}
          onClick={() => !readOnly && onChange(star)}
          onMouseEnter={() => !readOnly && setHovered(star)}
        >
          <Star
            aria-hidden="true"
            className={cn(
              "w-8 h-8 transition-colors",
              star <= displayRating 
                ? "fill-amber-400 text-amber-400" 
                : "fill-transparent text-muted-foreground"
            )}
          />
        </button>
      ))}
    </div>
  );
}
