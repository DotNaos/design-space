import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Copy, Trash2 } from "lucide-react";
import { afterEach, expect, it, vi } from "vitest";

import { WorkspaceContextMenu } from "./WorkspaceContextMenu";

afterEach(cleanup);

it("focuses actions, routes selection, and dismisses with Escape", async () => {
  const onClose = vi.fn();
  const onCopy = vi.fn();
  const view = render(<WorkspaceContextMenu menu={{ x: 12, y: 16, label: "Card" }} actions={[
    { id: "copy", label: "Duplicate", icon: Copy, onSelect: onCopy },
    { id: "delete", label: "Delete", icon: Trash2, danger: true, disabled: true, onSelect: vi.fn() },
  ]} onClose={onClose} />);
  await userEvent.click(screen.getByRole("menuitem", { name: "Duplicate" }));
  expect(onCopy).toHaveBeenCalledOnce();
  expect(onClose).toHaveBeenCalledOnce();

  view.rerender(<WorkspaceContextMenu menu={{ x: 12, y: 16, label: "Card" }} actions={[
    { id: "copy", label: "Duplicate", icon: Copy, onSelect: onCopy },
  ]} onClose={onClose} />);
  await userEvent.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(2);
});

it("moves through actions with arrow keys and restores the invoking focus", async () => {
  render(<button type="button">Canvas target</button>);
  const trigger = screen.getByRole("button", { name: "Canvas target" });
  trigger.focus();
  const view = render(<WorkspaceContextMenu menu={{ x: 12, y: 16, label: "Card" }} actions={[
    { id: "copy", label: "Duplicate", icon: Copy, onSelect: vi.fn() },
    { id: "delete", label: "Delete", icon: Trash2, onSelect: vi.fn() },
  ]} onClose={vi.fn()} />);
  const duplicate = screen.getByRole("menuitem", { name: "Duplicate" });
  const remove = screen.getByRole("menuitem", { name: "Delete" });

  await waitFor(() => expect(duplicate).toHaveFocus());
  await userEvent.keyboard("{ArrowDown}");
  expect(remove).toHaveFocus();
  await userEvent.keyboard("{Home}");
  expect(duplicate).toHaveFocus();

  view.unmount();
  expect(trigger).toHaveFocus();
});
