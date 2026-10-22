"use client";

import { useEffect, useRef, useState } from "react";
import { PendingFeedback } from "./pending-feedback";
import { Button } from "./button";

type ReadFeedbackProps = {
  pending: boolean;
  operationKey: string;
  label?: string;
  retry?: () => Promise<unknown> | void;
  className?: string;
  error?: string | Error | null;
};

export function ReadFeedback(props: ReadFeedbackProps) {
  return <ScopedReadFeedback key={props.operationKey} {...props}/>;
}

function ScopedReadFeedback({ pending, operationKey, label, retry, className, error }: ReadFeedbackProps) {
  const [attempt, setAttempt] = useState(0);
  const [failure, setFailure] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const generation = useRef(0);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const message = failure ?? (!retrying ? error instanceof Error ? error.message : error : null);
  const onRetry = retry ? () => {
    const current = ++generation.current;
    setFailure(null);
    setRetrying(true);
    setAttempt(value => value + 1);
    void Promise.resolve().then(retry).catch(cause => {
      if (alive.current && generation.current === current) setFailure(cause instanceof Error ? cause.message : "Could not load this content. Please try again.");
    }).finally(() => { if (alive.current && generation.current === current) setRetrying(false); });
  } : undefined;
  if (message) return <div className={className}><p role="alert" className="py-4 text-sm text-foreground">{message}</p><div className="flex flex-wrap gap-2">{retry && <Button type="button" variant="outline" onClick={onRetry}>Try again</Button>}<Button type="button" variant="outline" onClick={() => window.location.reload()}>Refresh page</Button></div></div>;
  return <PendingFeedback pending={pending || retrying} operationKey={`${operationKey}:${attempt}`} label={label} className={className}
    onRetry={onRetry}
    onRefresh={() => window.location.reload()} />;
}
