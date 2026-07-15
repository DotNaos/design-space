import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { isWorkspaceDeleteShortcut, useWorkspaceKeyboardCommands } from "./use-workspace-keyboard-commands";

describe("workspace keyboard commands", () => {
  it("runs Delete and Backspace only for an unmodified workspace key press", () => {
    const onDelete = vi.fn();
    renderHook(() => useWorkspaceKeyboardCommands({ onDelete }));

    const deleted = new KeyboardEvent("keydown", { key: "Delete", bubbles: true, cancelable: true });
    act(() => window.dispatchEvent(deleted));
    expect(deleted.defaultPrevented).toBe(true);
    expect(onDelete).toHaveBeenCalledTimes(1);

    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", metaKey: true, bubbles: true })));
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("ignores inputs, text areas, selects, and contenteditable descendants", () => {
    const targets = [
      document.createElement("input"),
      document.createElement("textarea"),
      document.createElement("select"),
      document.createElement("span"),
    ];
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    editable.append(targets[3]);
    document.body.append(...targets.slice(0, 3), editable);

    for (const target of targets) {
      expect(isWorkspaceDeleteShortcut({
        key: "Delete",
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        target,
      })).toBe(false);
    }
    expect(isWorkspaceDeleteShortcut({
      key: "Delete",
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      target: document.body,
    })).toBe(true);

    document.body.replaceChildren();
  });
});
