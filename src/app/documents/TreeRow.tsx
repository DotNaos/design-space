
import { Button } from "@heroui/react";
import { ChevronDown, ChevronRight } from "lucide-react";

export function TreeRow(props: { expanded?: boolean; icon: React.ReactNode; label: string; onPress?: () => void }) {
  const content = <>{props.onPress ? props.expanded ? <ChevronDown aria-hidden="true" size={13} /> : <ChevronRight aria-hidden="true" size={13} /> : <span className="w-[13px]" />}{props.icon}<span className="truncate">{props.label}</span></>;
  if (!props.onPress) return <div className="flex h-9 items-center gap-2 px-2 text-xs font-medium text-zinc-400">{content}</div>;
  return <Button fullWidth className="flex h-9 min-h-9 justify-start gap-2 rounded-lg px-2 text-xs font-medium text-zinc-300 hover:bg-white/[0.04]" variant="ghost" onPress={props.onPress}>{content}</Button>;
}
