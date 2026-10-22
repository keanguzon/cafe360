"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { refreshPage } from "@/lib/navigation/browser-recovery";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error boundary caught:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center p-6 text-center space-y-4">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertCircle className="size-7" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-foreground">Something went wrong</h2>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          We encountered an issue loading this section. Please try again.
        </p>
      </div>
      <Button
        onClick={() => reset()}
        variant="outline"
        className="h-10 px-4 text-xs font-medium flex items-center gap-2 cursor-pointer"
      >
        <RefreshCw className="size-3.5" />
        <span>Try Again</span>
      </Button>
      <Button type="button" variant="outline" onClick={refreshPage}>Refresh page</Button>
    </div>
  );
}
