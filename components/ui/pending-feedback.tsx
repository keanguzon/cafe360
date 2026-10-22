"use client";

import { Loader2 } from "lucide-react";
import { usePendingFeedback } from "@/lib/hooks/use-pending-feedback";
import { cn } from "@/lib/utils";
import { Button } from "./button";

type PendingFeedbackProps = {
  pending: boolean;
  operationKey: string;
  hasUsableData?: boolean;
  kind?: "read" | "mutation";
  retrySafe?: boolean;
  onRetry?: () => void;
  onRefresh: () => void;
  label?: string;
  className?: string;
};

export function PendingFeedback({
  pending,
  operationKey,
  hasUsableData = false,
  kind = "read",
  retrySafe = false,
  onRetry,
  onRefresh,
  label = "Loading…",
  className,
}: PendingFeedbackProps) {
  const phase = usePendingFeedback({ pending, operationKey, hasUsableData, kind });
  if (phase === "idle") return null;

  if (phase === "pending") {
    return (
      <div role="status" className={cn("flex items-center justify-center gap-2 py-4 text-sm text-foreground", className)}>
        <Loader2 aria-hidden="true" className="size-5 shrink-0 animate-spin motion-reduce:animate-none" />
        <span>{label}</span>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3 py-4 text-sm text-foreground", className)}>
      <p role="alert">
        {kind === "mutation"
          ? "This is taking too long. Your changes are not confirmed yet. Check the latest status before trying again."
          : "This is taking too long. Please try again."}
      </p>
      <div className="flex flex-wrap gap-2">
        {onRetry && (kind === "read" || retrySafe) && (
          <Button type="button" variant="outline" onClick={onRetry}>Try again</Button>
        )}
        <Button type="button" variant="outline" onClick={onRefresh}>Refresh page</Button>
      </div>
    </div>
  );
}
