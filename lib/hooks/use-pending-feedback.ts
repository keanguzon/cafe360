"use client";

import { useEffect, useMemo, useState } from "react";

export const PENDING_TIMEOUT_MS = 10_000;

export function usePendingFeedback({
  pending,
  operationKey,
  hasUsableData = false,
  kind = "read",
}: {
  pending: boolean;
  operationKey: string;
  hasUsableData?: boolean;
  kind?: "read" | "mutation";
}): "idle" | "pending" | "timeout" {
  const active = pending && (kind === "mutation" || !hasUsableData);
  const episode = useMemo(() => ({ active, operationKey }), [active, operationKey]);
  const [expiredEpisode, setExpiredEpisode] = useState<typeof episode | null>(null);

  useEffect(() => {
    if (!episode.active) return;
    const timer = setTimeout(() => setExpiredEpisode(episode), PENDING_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [episode]);

  if (!active) return "idle";
  return expiredEpisode === episode ? "timeout" : "pending";
}
