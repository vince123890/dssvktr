import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

/**
 * Wide tables scroll sideways inside their card instead of squeezing or
 * pushing the whole page sideways on a phone (PRD FR-5.8). The table
 * itself should carry a `min-w-[...]` so columns keep their width.
 */
export function TableScroll({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("overflow-x-auto overscroll-x-contain", className)} {...props} />;
}
