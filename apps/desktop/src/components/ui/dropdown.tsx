import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export function Dropdown({
  trigger,
  children,
  align = "end",
}: {
  trigger: ReactNode;
  children: ReactNode;
  align?: "start" | "center" | "end";
}) {
  return (
    <DropdownPrimitive.Root>
      <DropdownPrimitive.Trigger asChild>{trigger}</DropdownPrimitive.Trigger>
      <DropdownPrimitive.Portal>
        <DropdownPrimitive.Content
          align={align}
          sideOffset={6}
          className="z-50 min-w-[176px] rounded-[10px] border border-[var(--border)] bg-[var(--panel)] p-1.5 shadow-[var(--shadow-soft)] outline-none"
        >
          {children}
        </DropdownPrimitive.Content>
      </DropdownPrimitive.Portal>
    </DropdownPrimitive.Root>
  );
}

export function DropdownItem({
  children,
  onSelect,
  danger,
  disabled,
}: {
  children: ReactNode;
  onSelect?: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <DropdownPrimitive.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 rounded-[7px] px-2.5 py-2 text-[12px] outline-none transition data-[highlighted]:bg-[var(--panel-2)]",
        danger
          ? "text-[var(--danger)] data-[highlighted]:bg-red-500/10"
          : "text-[var(--ink)]",
        disabled && "pointer-events-none opacity-40",
      )}
    >
      {children}
    </DropdownPrimitive.Item>
  );
}

export function DropdownSeparator() {
  return (
    <DropdownPrimitive.Separator className="my-1 h-px bg-[var(--line)]" />
  );
}
