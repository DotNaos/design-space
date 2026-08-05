import { Button } from "@heroui/react";
import { PencilRuler } from "lucide-react";

export function PageButton(props: {
  active: boolean;
  icon: typeof PencilRuler;
  label: string;
  onPress: () => void;
}) {
  const Icon = props.icon;
  return (
    <Button
      aria-current={props.active ? "page" : undefined}
      aria-label={`Open ${props.label} page`}
      className={`size-11 rounded-xl transition-colors ${props.active ? "bg-sky-400/15 text-sky-300" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"}`}
      isIconOnly
      variant="ghost"
      onPress={props.onPress}
    >
      <Icon size={18} strokeWidth={props.active ? 2.2 : 1.8} />
    </Button>
  );
}
