import { useEffect } from "react";

export function useWorkspaceKeyboardCommands(options: {
  enabled?: boolean;
  onDelete: () => void;
}): void {
  useEffect(() => {
    if (options.enabled === false) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isWorkspaceDeleteShortcut(event)) return;
      event.preventDefault();
      options.onDelete();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [options.enabled, options.onDelete]);
}

export function isWorkspaceDeleteShortcut(event: Pick<KeyboardEvent, "altKey" | "ctrlKey" | "key" | "metaKey" | "shiftKey" | "target">): boolean {
  if (event.key !== "Delete" && event.key !== "Backspace") return false;
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false;
  return !isEditableTarget(event.target);
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])"));
}
