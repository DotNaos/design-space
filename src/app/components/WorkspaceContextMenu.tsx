import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";

export type WorkspaceContextAction = {
  id: string;
  label: string;
  icon: LucideIcon;
  danger?: boolean;
  disabled?: boolean;
  shortcut?: string;
  onSelect: () => void;
};

export type WorkspaceContextMenuState = {
  x: number;
  y: number;
  label: string;
};

export function WorkspaceContextMenu(props: {
  menu: WorkspaceContextMenuState;
  actions: readonly WorkspaceContextAction[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const [position, setPosition] = useState({ x: props.menu.x, y: props.menu.y });

  useLayoutEffect(() => {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const menu = ref.current;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    setPosition({
      x: Math.max(8, Math.min(props.menu.x, window.innerWidth - rect.width - 8)),
      y: Math.max(8, Math.min(props.menu.y, window.innerHeight - rect.height - 8)),
    });
    menu.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
    return () => {
      if (previousFocus.current?.isConnected) previousFocus.current.focus({ preventScroll: true });
    };
  }, [props.menu.x, props.menu.y]);

  useEffect(() => {
    const close = (event: Event) => {
      if (ref.current?.contains(event.target as Node)) return;
      props.onClose();
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        props.onClose();
        return;
      }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      const buttons = [...(ref.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
      if (buttons.length === 0) return;
      event.preventDefault();
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : event.key === "ArrowDown"
            ? (current + 1 + buttons.length) % buttons.length
            : (current - 1 + buttons.length) % buttons.length;
      buttons[next]?.focus({ preventScroll: true });
    };
    window.addEventListener("pointerdown", close, true);
    window.addEventListener("blur", props.onClose);
    document.addEventListener("keydown", keydown, true);
    return () => {
      window.removeEventListener("pointerdown", close, true);
      window.removeEventListener("blur", props.onClose);
      document.removeEventListener("keydown", keydown, true);
    };
  }, [props.onClose]);

  return (
    <div
      ref={ref}
      aria-label={`${props.menu.label} actions`}
      className="fixed z-[80] min-w-52 overflow-hidden rounded-lg border border-white/10 bg-[#1a1b1e] p-1 text-zinc-200 shadow-2xl"
      role="menu"
      style={{ left: position.x, top: position.y }}
    >
      {props.actions.map(({ icon: Icon, ...action }) => (
        <button
          key={action.id}
          className={`flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-xs outline-none disabled:opacity-35 ${action.danger ? "text-rose-300 hover:bg-rose-500/10 focus-visible:bg-rose-500/10" : "text-zinc-300 hover:bg-white/5 focus-visible:bg-white/5"}`}
          disabled={action.disabled}
          role="menuitem"
          type="button"
          onClick={() => {
            action.onSelect();
            props.onClose();
          }}
        >
          <Icon aria-hidden="true" size={14} />
          <span className="flex-1">{action.label}</span>
          {action.shortcut && <kbd className="text-[9px] text-zinc-600">{action.shortcut}</kbd>}
        </button>
      ))}
    </div>
  );
}
