import { Switch } from "@heroui/react";

export function ContractSwitch(props: {
  label: string;
  description?: string;
  selected: boolean;
  onChange: (selected: boolean) => void;
}) {
  return (
    <Switch aria-label={props.label} isSelected={props.selected} onChange={props.onChange}>
      <Switch.Content className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-white/5 bg-black/10 px-3">
        <span className="min-w-0">
          <span className="block text-xs text-zinc-300">{props.label}</span>
          {props.description ? <span className="mt-0.5 block text-[9px] leading-4 text-zinc-600">{props.description}</span> : null}
        </span>
        <Switch.Control className="shrink-0"><Switch.Thumb /></Switch.Control>
      </Switch.Content>
    </Switch>
  );
}
