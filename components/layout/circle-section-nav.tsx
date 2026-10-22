"use client";

import { useEffect, useRef, useState } from "react";

const sections = [
  ["members", "Members"], ["cafes", "Cafés"], ["activity", "Activity"], ["memories", "Memories"],
] as const;

export function CircleSectionNav() {
  const nav = useRef<HTMLElement>(null);
  const [active, setActive] = useState<string>("members");
  useEffect(() => {
    const scroller = nav.current?.closest<HTMLElement>("[data-sheet-scroll]");
    if (!scroller) return;
    const update = () => {
      const boundary = (nav.current?.getBoundingClientRect().bottom ?? 0) + 8;
      let current: string = "members";
      for (const [id] of sections) {
        const section = scroller.querySelector<HTMLElement>(`[data-circle-section="${id}"]`);
        if (section && section.getBoundingClientRect().top <= boundary) current = id;
      }
      if (scroller.scrollHeight > scroller.clientHeight && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2) current = "memories";
      setActive(current);
    };
    update();scroller.addEventListener("scroll", update, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    if (scroller.firstElementChild) observer?.observe(scroller.firstElementChild);
    return () => { scroller.removeEventListener("scroll", update);observer?.disconnect(); };
  }, []);

  return <nav ref={nav} aria-label="Circle sections" className="sticky top-0 z-10 -mx-4 grid grid-cols-4 border-b border-border bg-surface px-2">
    {sections.map(([id,label]) => <button key={id} type="button" aria-current={active===id ? "location" : undefined}
      className={`min-h-11 border-b-2 px-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${active===id ? "border-accent text-foreground" : "border-transparent text-muted-foreground"}`}
      onClick={() => {
        const scroller = nav.current?.closest<HTMLElement>("[data-sheet-scroll]");
        const section = scroller?.querySelector<HTMLElement>(`[data-circle-section="${id}"]`);
        if (!scroller || !section || !nav.current) return;
        scroller.scrollTo({ top:Math.max(0,scroller.scrollTop+section.getBoundingClientRect().top-nav.current.getBoundingClientRect().bottom), behavior:window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      }}>{label}</button>)}
  </nav>;
}
