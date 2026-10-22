"use client";
import { Loader2 } from "lucide-react";
import { usePendingFeedback } from "@/lib/hooks/use-pending-feedback";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { signVisitPhotoAction } from "@/lib/actions/photo-actions";
import { useCircle } from "@/lib/context/circle-context";

export function PrivatePhoto({ path, groupId }: { path: string; groupId?: string | null }) {
  const { accountId, activeCircle, userCircles } = useCircle();
  const requestedCircleId = groupId ?? activeCircle?.id ?? null;
  const circleId = userCircles.some((circle) => circle.id === requestedCircleId) ? requestedCircleId : null;
  return <ScopedPrivatePhoto key={JSON.stringify([accountId, circleId, path])} accountId={accountId} circleId={circleId} path={path}/>;
}

function ScopedPrivatePhoto({ accountId, circleId, path }: { accountId: string; circleId: string | null; path: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const { data, error, isLoading, mutate } = useSWR(
    circleId ? ["memory-photo", accountId, circleId, path] : null,
    async () => {
      const result = await signVisitPhotoAction(path);
      if (!result.success || !result.url || !result.expiresAt || result.expiresAt <= Date.now()) {
        throw new Error(result.error || "Photo unavailable");
      }
      return result;
    },
    { refreshInterval: 45_000, dedupingInterval: 5_000, shouldRetryOnError: false },
  );

  useEffect(() => {
    if (!data?.expiresAt || !data.url) return;
    const remainingMs = Math.max(0, data.expiresAt - Date.now());
    const timer = window.setTimeout(() => {
      setFailedUrl(data.url ?? null);
      void mutate().catch(cause => setRetryError(cause instanceof Error ? cause.message : "Photo unavailable"));
    }, remainingMs);
    return () => window.clearTimeout(timer);
  }, [data?.expiresAt, data?.url, mutate]);

  const url = circleId && !error && data?.url ? data.url : undefined;
  const phase = usePendingFeedback({
    pending: retrying || (isLoading && !error && !retryError),
    hasUsableData: !!url && url !== failedUrl,
    operationKey: `photo:${accountId}:${circleId}:${path}:${attempt}`,
    kind: "read",
  });
  if (phase === "pending") return <span role="status" aria-label="Loading photo…" className="flex h-full w-full items-center justify-center"><Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none text-muted-foreground"/></span>;
  if (!url || url === failedUrl || phase === "timeout") {
    const message = phase === "timeout" ? "Photo loading is taking too long. Retry photo." : "Photo unavailable. Retry photo.";
    if (!circleId) return <span role="status" aria-label="Photo unavailable" className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">Unavailable</span>;
    return <><span role="alert" className="sr-only">{message}</span><button type="button" aria-label={message} title={message} onClick={() => {
      setAttempt(value => value + 1); setRetryError(null); setRetrying(true); setFailedUrl(null);
      void mutate().catch(cause => setRetryError(cause instanceof Error ? cause.message : "Photo unavailable")).finally(() => setRetrying(false));
    }} className="flex h-full min-h-11 w-full items-center justify-center p-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent">Retry</button></>;
  }
  // Signed URLs expire quickly; never persist them in a durable client cache.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="Circle memory" className="h-full w-full object-cover" loading="lazy" onError={() => setFailedUrl(url)} />;
}
