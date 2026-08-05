
import { ChevronDown, ChevronRight } from "lucide-react";

export function BranchChevron(props: {
  branchKey?: string;
  branchCollapsed: boolean;
  hasDescendants: boolean;
  label: string;
  onToggleBranch: (branchKey: string) => void;
}) {
  if (!props.hasDescendants || !props.branchKey) return <span aria-hidden="true" className="w-6 shrink-0" />;
  return (
    <button
      aria-expanded={!props.branchCollapsed}
      aria-label={`${props.branchCollapsed ? "Expand" : "Collapse"} ${props.label}`}
      className="relative z-10 grid size-6 shrink-0 place-items-center rounded text-zinc-600 hover:bg-white/[0.07] hover:text-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-400"
      data-tree-branch-for={props.branchKey}
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        props.onToggleBranch(props.branchKey!);
      }}
    >
      {props.branchCollapsed ? <ChevronRight aria-hidden="true" size={13} /> : <ChevronDown aria-hidden="true" size={13} />}
    </button>
  );
}
