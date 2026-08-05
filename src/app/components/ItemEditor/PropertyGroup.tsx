import { Button } from "@heroui/react";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

export function PropertyGroup(props: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="border-b border-white/10">
      <Button
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-start gap-2 rounded-none px-4 text-left text-[10px] font-medium text-zinc-400 hover:bg-white/[0.02]"
        variant="ghost"
        onPress={() => setOpen((value) => !value)}
      >
        <span className="flex-1">{props.title}</span>
        <ChevronDown size={13} className={`text-zinc-600 transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>
      {open && <div className="space-y-4 px-4 pb-4">{props.children}</div>}
    </section>
  );
}
