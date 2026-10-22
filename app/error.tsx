"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { refreshPage } from "@/lib/navigation/browser-recovery";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root application error:", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center p-6 text-center space-y-4 bg-background">
      <div className="flex size-16 items-center justify-center rounded-3xl bg-destructive/10 text-destructive shadow-lg">
        <AlertTriangle className="size-8" />
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-foreground">Application Error</h1>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          An unexpected error occurred. You can attempt to refresh the page.
        </p>
      </div>
      <Button
        onClick={() => reset()}
        className="h-11 px-6 text-xs font-semibold bg-accent text-accent-foreground hover:bg-accent/90 flex items-center gap-2 cursor-pointer"
      >
        <RefreshCw className="size-4" />
        <span>Reload Application</span>
      </Button>
      <Button type="button" variant="outline" onClick={refreshPage}>Refresh page</Button>
    </div>
  );
}
