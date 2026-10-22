"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function UserAvatar({ src, name, className, fallback, decorative = false }: {
  src?: string | null;
  name: string;
  className?: string;
  fallback?: ReactNode;
  decorative?: boolean;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const initials = name.trim().split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase() || "U";
  return <span role={decorative ? undefined : "img"} aria-label={decorative ? undefined : name} aria-hidden={decorative || undefined} title={name}
    className={cn("relative inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent/10 text-xs font-bold text-accent", className)}>
    {fallback ?? initials}
    {src && src !== failedSrc && <Image src={src} alt="" width={96} height={96} unoptimized
      className="absolute inset-0 size-full object-cover" onError={() => setFailedSrc(src)}/>}
  </span>;
}
