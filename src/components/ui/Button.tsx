import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium whitespace-nowrap",
    // Press feedback: a quick scale-down plus a shadow that collapses, so
    // a click is visibly acknowledged even when the resulting navigation
    // takes a moment.
    "transition-[transform,background-color,box-shadow,opacity] duration-150 ease-out",
    "active:scale-[0.97] active:duration-75",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary/40",
    "disabled:opacity-50 disabled:pointer-events-none",
    // Respect users who ask for less motion.
    "motion-reduce:transition-none motion-reduce:active:scale-100",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-sm hover:bg-blue-700 active:bg-blue-800 active:shadow-none",
        secondary:
          "bg-white border border-card-border text-foreground shadow-sm hover:bg-slate-50 active:bg-slate-100 active:shadow-none",
        ghost: "text-foreground hover:bg-slate-100 active:bg-slate-200",
        danger:
          "bg-danger text-white shadow-sm hover:bg-red-700 active:bg-red-800 active:shadow-none",
        success:
          "bg-success text-white shadow-sm hover:bg-green-700 active:bg-green-800 active:shadow-none",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-9 px-4",
        lg: "h-11 px-6 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Shows a spinner and blocks further clicks while an action is running. */
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && (
        <Loader2
          size={size === "lg" ? 17 : 14}
          className="animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}
