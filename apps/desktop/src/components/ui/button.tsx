import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../../lib/utils";

type Variant = "default" | "secondary" | "ghost" | "outline" | "danger" | "soft";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  default:
    "bg-[var(--accent)] text-[var(--on-accent)] shadow-[0_6px_14px_-8px_var(--accent)] hover:bg-[var(--accent-strong)] active:translate-y-px",
  secondary:
    "bg-[var(--panel)] text-[var(--ink)] border border-[var(--border)] hover:bg-[var(--panel-2)]",
  ghost: "text-[var(--muted)] hover:bg-[var(--panel-2)] hover:text-[var(--ink)]",
  outline:
    "border border-[var(--border)] bg-transparent text-[var(--ink)] hover:bg-[var(--panel-2)]",
  danger:
    "bg-[var(--danger)] text-[var(--on-accent)] hover:brightness-105 active:translate-y-px",
  soft: "bg-[var(--accent-soft)] text-[var(--accent)] hover:brightness-105",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[12px] rounded-[8px] gap-1.5",
  md: "h-[34px] px-[13px] text-[12.5px] rounded-[9px] gap-[7px]",
  lg: "h-10 px-5 text-[13px] rounded-[10px] gap-2",
  icon: "h-8 w-8 rounded-[8px]",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(
          "inline-flex select-none items-center justify-center font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
