import type { ReactNode } from "react";

export interface ProjectSummaryProps {
  label: string;
  ready?: boolean;
  children?: ReactNode;
}

export function ProjectSummary({ label, ready = false, children }: ProjectSummaryProps) {
  return <section><p>{label}: {ready ? "ready" : "checking"}</p>{children}</section>;
}
