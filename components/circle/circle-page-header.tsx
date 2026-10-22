"use client";

import { NavigationLink as Link } from "@/components/navigation/navigation-feedback";
import { useCircle } from "@/lib/context/circle-context";

export function CirclePageHeader({ circleId, title }: { circleId: string; title: string }) {
  const context = useCircle();
  const circle = context.accountId && context.membershipsResolved
    ? context.userCircles.find(item => item.id === circleId) : undefined;

  return <header className="mb-6 min-w-0 text-foreground">
    <Link href="/map" className="mb-3 inline-flex min-h-11 items-center rounded px-2 text-sm font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Return to map</Link>
    {circle && <p className="break-words text-sm text-muted-foreground">{circle.name}</p>}
    <h1 className="break-words text-2xl font-semibold">{title}</h1>
    {!context.membershipsResolved ? <p role="status" className="mt-4">Loading Circle…</p>
      : !circle ? <p role="status" className="mt-4">This Circle is unavailable.</p>
      : context.activeCircle?.id !== circleId && <div className="mt-4">
        <p>Select this Circle to see its shared content.</p>
        <button type="button" onClick={() => context.setActiveCircleId(circle.id)} className="mt-2 min-h-11 rounded px-2 text-sm font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Select this Circle</button>
      </div>}
  </header>;
}
