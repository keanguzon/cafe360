import type { ReactNode } from "react";

export default function EntryLayout({ children }: { children: ReactNode }) {
  return <main className="min-h-dvh bg-background pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-foreground">{children}</main>;
}
