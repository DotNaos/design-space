import { Button } from "@heroui/react";
import type { LucideIcon } from "lucide-react";

export function BoxModeButton(props: { icon: LucideIcon; isOn: boolean; label: string; onPress: () => void }) {
  return (
    <Button
      isIconOnly
      aria-label={props.label}
      aria-pressed={props.isOn}
      className={`size-7 !min-h-0 !min-w-0 rounded-lg !p-0 transition-colors ${
        props.isOn ? "bg-[#25272e] text-zinc-200" : "text-zinc-600 hover:bg-[#1d1f24] hover:text-zinc-300"
      }`}
      size="sm"
      variant="ghost"
      onPress={props.onPress}
    >
      <props.icon aria-hidden="true" size={12} />
    </Button>
  );
}
