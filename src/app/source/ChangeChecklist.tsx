import { Button, Checkbox, Label } from "@heroui/react";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { type SourceChangeReviewItem, type SourceChangeReviewState } from "./source-change-review";

export function ChangeChecklist(props: {
  activeId: string;
  applying: boolean;
  changes: readonly SourceChangeReviewItem[];
  reviewState: SourceChangeReviewState;
  onActivate: (id: string) => void;
  onApprovalChange: (id: string, approved: boolean) => void;
  onInclusionChange: (id: string, included: boolean) => void;
}) {
  return (
    <aside aria-label="Change approval checklist" className="min-h-0 overflow-y-auto border-b border-white/10 bg-[#141518] lg:border-b-0 lg:border-r">
      <div className="border-b border-white/[0.07] px-3 py-2">
        <p className="text-[9px] font-medium text-zinc-600">Changed files</p>
        <p className="mt-1 text-[10px] text-zinc-500">Select what to apply, then approve each current version.</p>
      </div>
      <div className="max-h-48 divide-y divide-white/[0.05] lg:max-h-none">
        {props.changes.map((change) => {
          const state = props.reviewState[change.id];
          return (
            <div
              className={`grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 px-2 py-2 ${props.activeId === change.id ? "bg-sky-500/10" : "hover:bg-white/[0.025]"}`}
              key={change.id}
            >
              <Checkbox
                aria-label={`Include ${change.label}`}
                className="mt-0.5"
                isDisabled={props.applying}
                isSelected={state?.included}
                onChange={(included) => props.onInclusionChange(change.id, included)}
              >
                <Checkbox.Content>
                  <Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>
                </Checkbox.Content>
              </Checkbox>
              <Button
                aria-pressed={props.activeId === change.id}
                className="h-auto min-w-0 justify-start rounded-sm p-0 text-left"
                isDisabled={props.applying}
                variant="ghost"
                onPress={() => props.onActivate(change.id)}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-medium text-zinc-300">{change.label}</span>
                  <span className="mt-0.5 block truncate font-mono text-[9px] text-zinc-600">{change.path}</span>
                </span>
              </Button>
              <div className="col-start-2 mt-2 flex min-w-0 items-center gap-2">
                <Checkbox
                  aria-label={`Approve ${change.label}`}
                  isDisabled={props.applying || !state?.included || !change.valid}
                  isInvalid={!change.valid}
                  isSelected={state?.approved}
                  onChange={(approved) => props.onApprovalChange(change.id, approved)}
                >
                  <Checkbox.Content className="gap-1.5">
                    <Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>
                    <Label className="text-[10px] text-zinc-500">Approved</Label>
                  </Checkbox.Content>
                </Checkbox>
                {!change.valid && <span className="ml-auto flex items-center gap-1 text-[9px] text-amber-300"><CircleAlert size={11} /> Invalid</span>}
                {change.valid && state?.approved && <CheckCircle2 aria-label={`${change.label} approved`} className="ml-auto text-emerald-400" size={12} />}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
