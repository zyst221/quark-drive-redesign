import * as React from "react";
import { cn } from "../../lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-9 w-full rounded-[9px] border border-[var(--border)] bg-[var(--panel-2)] px-3 text-[13px] text-[var(--ink)] outline-none transition placeholder:text-[var(--faint)] focus:border-[var(--accent)] focus:bg-[var(--panel)] focus:ring-[3px] focus:ring-[var(--accent-soft)]",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
