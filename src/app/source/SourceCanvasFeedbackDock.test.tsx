import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type { SourceCanvasAnnotation, SourceFeedbackContext } from "./source-feedback";

const { inspectSourceCodexOrigin, sendSourceCodexFeedback } = vi.hoisted(() => ({
  inspectSourceCodexOrigin: vi.fn(),
  sendSourceCodexFeedback: vi.fn(),
}));

vi.mock("./source-codex-feedback-client", async (importOriginal) => ({
  ...await importOriginal<typeof import("./source-codex-feedback-client")>(),
  inspectSourceCodexOrigin,
  sendSourceCodexFeedback,
}));

import { SourceCanvasFeedbackDock } from "./SourceCanvasFeedbackDock";

const context: SourceFeedbackContext = {
  id: "button:label",
  kind: "layer",
  label: "button",
  source: {
    end: 24,
    relativePath: "src/components/Button.tsx",
    start: 12,
  },
};
const annotation: SourceCanvasAnnotation = {
  comment: "Make this action clearer.",
  context,
  element: "<button>",
  id: "annotation-1",
  occurrence: 0,
  point: { x: 0.5, y: 0.5 },
};

beforeEach(() => {
  inspectSourceCodexOrigin.mockResolvedValue({
    status: "active",
    threadId: "019f651f-2bca-7513-9be5-857cb5fb86e6",
    title: "Design Space",
    writable: true,
  });
  sendSourceCodexFeedback.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.localStorage.clear();
});

it("sends pending canvas annotations without requiring a separate message", async () => {
  const onAnnotationsSent = vi.fn();
  render(
    <SourceCanvasFeedbackDock
      annotations={[annotation]}
      context={context}
      onAnnotationModeChange={vi.fn()}
      onAnnotationsSent={onAnnotationsSent}
    />,
  );

  const send = screen.getByRole("button", { name: "Send to Codex" });
  await waitFor(() => expect(send).toBeEnabled());
  await userEvent.click(send);

  await waitFor(() => expect(sendSourceCodexFeedback).toHaveBeenCalledOnce());
  expect(sendSourceCodexFeedback.mock.calls[0]?.[1]).toContain("Design Space annotations");
  expect(sendSourceCodexFeedback.mock.calls[0]?.[1]).toContain("Make this action clearer.");
  expect(onAnnotationsSent).toHaveBeenCalledOnce();
});

it("keeps context, the connected task, and the composer in one compact dock", async () => {
  render(<SourceCanvasFeedbackDock context={context} meta={<span>Design · Button</span>} onAnnotationModeChange={vi.fn()} />);

  const indicator = await screen.findByRole("button", {
    name: "Connected to Design Space. Change Codex task",
  });
  expect(indicator).toHaveTextContent("Design Space");
  expect(indicator).toHaveClass("text-emerald-200");
  const composer = screen.getByLabelText("Codex composer");
  const sessionRow = screen.getByTestId("source-codex-session-stack");
  expect(sessionRow).toContainElement(indicator);
  expect(sessionRow).toHaveTextContent("Design · Button");
  expect(screen.getByTestId("source-canvas-feedback-dock")).toContainElement(composer);
  expect(composer).not.toContainElement(indicator);
  expect(screen.getByRole("textbox", { name: "Codex feedback" })).toBeEnabled();
});

it("disables composer actions while no Codex task is connected", async () => {
  inspectSourceCodexOrigin.mockResolvedValueOnce(undefined);
  render(<SourceCanvasFeedbackDock context={context} onAnnotationModeChange={vi.fn()} />);

  const connect = await screen.findByRole("button", { name: "Connect Codex task" });
  expect(connect).toHaveTextContent("Connect Codex");
  expect(connect).toHaveClass("text-rose-200");
  expect(screen.getByRole("textbox", { name: "Codex feedback" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Add a canvas annotation" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Open full Codex conversation" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Send to Codex" })).toBeDisabled();
  expect(screen.getByLabelText("Codex composer")).toHaveAttribute("aria-disabled", "true");
});
