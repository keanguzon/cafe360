"use client";

import { Toaster } from "sonner";
import { useRealtime } from "@/lib/hooks/use-realtime";

export function RealtimeProvider({ children }: { children?: React.ReactNode }) {
  useRealtime();

  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          className:
            "!bg-surface !text-foreground !border-border !rounded-2xl !shadow-xl !font-sans",
          descriptionClassName: "!text-muted-foreground !text-xs",
        }}
      />
      {children}
    </>
  );
}
