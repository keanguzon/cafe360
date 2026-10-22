"use client";

import { createContext, forwardRef, useCallback, useContext, useEffect, useId, useMemo, useState, useTransition, type ComponentProps, type ReactNode } from "react";
import Link, { useLinkStatus } from "next/link";
import { useRouter } from "next/navigation";
import { PendingFeedback } from "@/components/ui/pending-feedback";
import { formatHref } from "@/lib/navigation/format-href";
import { refreshPage, retryPage } from "@/lib/navigation/browser-recovery";

type FeedbackContext = {
  report(id: string, href: string | null): void;
  run(action: () => void): void;
};
const Context = createContext<FeedbackContext | null>(null);

export function NavigationFeedbackProvider({ children }: { children: ReactNode }) {
  const [links, setLinks] = useState<ReadonlyMap<string, string>>(new Map());
  const [transitionPending, startTransition] = useTransition();
  const [attempt, setAttempt] = useState(0);
  const report = useCallback((id: string, href: string | null) => {
    setLinks(previous => {
      if (href === null && !previous.has(id) || href !== null && previous.get(id) === href) return previous;
      const next = new Map(previous);
      if (href === null) next.delete(id); else next.set(id, href);
      return next;
    });
  }, []);
  const run = useCallback((action: () => void) => {
    setAttempt(value => value + 1);
    startTransition(action);
  }, []);
  const value = useMemo(() => ({ report, run }), [report, run]);
  const pending = links.size > 0 || transitionPending;
  const operationKey = JSON.stringify([Array.from(links), attempt]);
  const episode = useMemo(() => ({ pending, operationKey }), [pending, operationKey]);
  const [visibleEpisode, setVisibleEpisode] = useState<typeof episode | null>(null);
  useEffect(() => {
    if (!episode.pending) return;
    const timer = setTimeout(() => setVisibleEpisode(episode), 150);
    return () => clearTimeout(timer);
  }, [episode]);
  const href = Array.from(links.values()).at(-1);

  return <Context.Provider value={value}>
    {children}
    {pending && <div data-navigation-feedback className={`pointer-events-none fixed inset-0 z-[100] flex items-center justify-center p-4 ${visibleEpisode === episode ? "" : "invisible"}`}>
      <PendingFeedback pending operationKey={operationKey}
        label="Loading page…"
        onRetry={() => { if (href) retryPage(href); else refreshPage(); }}
        onRefresh={refreshPage}
        className="pointer-events-auto w-full max-w-sm rounded-xl border border-border bg-background p-5 shadow-sm" />
    </div>}
  </Context.Provider>;
}

function LinkPending({ href }: { href: ComponentProps<typeof Link>["href"] }) {
  const { pending } = useLinkStatus();
  const context = useContext(Context);
  const id = useId();
  const destination = formatHref(href);
  useEffect(() => {
    if (!context || !pending) return;
    context.report(id, destination);
    return () => context.report(id, null);
  }, [context, id, destination, pending]);
  return null;
}

export const NavigationLink = forwardRef<HTMLAnchorElement, ComponentProps<typeof Link>>(
  function NavigationLink({ children, href, ...props }, ref) {
    const context = useContext(Context);
    return <Link {...props} href={href} ref={ref}>{children}{context && <LinkPending href={href} />}</Link>;
  },
);

export function useFeedbackRouter(): ReturnType<typeof useRouter> {
  const router = useRouter();
  const context = useContext(Context);
  return useMemo(() => context ? {
    ...router,
    push: (...args: Parameters<typeof router.push>) => context.run(() => router.push(...args)),
    replace: (...args: Parameters<typeof router.replace>) => context.run(() => router.replace(...args)),
    back: () => context.run(() => router.back()),
    forward: () => context.run(() => router.forward()),
    refresh: () => context.run(() => router.refresh()),
  } : router, [router, context]);
}
