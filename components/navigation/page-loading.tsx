"use client";

import { usePathname } from "next/navigation";
import { ReadFeedback } from "@/components/ui/read-feedback";

export function PageLoading({ label = "Loading page…", className = "min-h-[60vh]" }: { label?: string; className?: string }) {
  const pathname = usePathname();
  return <div className={`flex w-full items-center justify-center bg-background p-6 ${className}`}>
    <ReadFeedback pending operationKey={pathname} label={label} />
  </div>;
}
