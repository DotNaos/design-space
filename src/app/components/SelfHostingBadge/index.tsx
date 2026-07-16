import type { ReactNode } from "react";

export interface SelfHostingBadgeProps {
  children?: ReactNode;
  label?: string;
}

export function SelfHostingBadge({ children, label = "SelfHostingBadge" }: SelfHostingBadgeProps) {
  return <div className={"inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-400/20"}>{children ?? label}</div>;
}
