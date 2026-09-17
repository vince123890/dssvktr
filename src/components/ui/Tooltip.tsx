"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Minimal hover tooltip — CSS-only (group-hover), no extra dependency.
 * Positioned above-left of the trigger; callers control trigger content
 * via `children`.
 */
export function Tooltip({
  content,
  children,
  className,
}: {
  content: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-flex group", className)}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full right-0 z-20 mb-2 w-64 -translate-y-0.5 rounded-lg border border-card-border bg-white p-2.5 text-[11px] leading-relaxed text-foreground opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
      >
        {content}
      </span>
    </span>
  );
}
