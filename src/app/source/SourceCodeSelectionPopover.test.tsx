import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import { SourceCodeSelectionPopover } from "./SourceCodeSelectionPopover";

afterEach(cleanup);

const selection = {
  anchor: { left: 32, top: 48 },
  endColumn: 14,
  endLine: 19,
  id: "src/app/App.tsx:50-90",
  relativePath: "src/app/App.tsx",
  selectedText: "const result = render();",
  startColumn: 3,
  startLine: 18,
};

it("attaches selected code or saves a comment from the same popup", async () => {
  const onAnnotate = vi.fn();
  const onAttach = vi.fn();
  render(
    <SourceCodeSelectionPopover
      selection={selection}
      onAnnotate={onAnnotate}
      onAttach={onAttach}
      onDismiss={vi.fn()}
    />,
  );

  expect(screen.getByText("Lines 18–19")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Add context" }));
  expect(onAttach).toHaveBeenCalledOnce();

  await userEvent.type(screen.getByRole("textbox", { name: "Code annotation comment" }), "Keep this branch static.");
  await userEvent.click(screen.getByRole("button", { name: "Add annotation" }));
  expect(onAnnotate).toHaveBeenCalledWith("Keep this branch static.");
});

it("dismisses after clicking outside the completed selection popup", async () => {
  const onDismiss = vi.fn();
  render(
    <div>
      <SourceCodeSelectionPopover
        selection={selection}
        onAnnotate={vi.fn()}
        onAttach={vi.fn()}
        onDismiss={onDismiss}
      />
      <button type="button">Canvas</button>
    </div>,
  );

  await userEvent.click(screen.getByRole("button", { name: "Canvas" }));
  expect(onDismiss).toHaveBeenCalledOnce();
});
