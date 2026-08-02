export interface ProjectSummaryProps {
  label: string;
  ready?: boolean;
  children?: never;
}

export function ProjectSummary({ label, ready = false }: ProjectSummaryProps) {
  return <section><p>{label}: {ready ? "ready" : "checking"}</p></section>;
}
