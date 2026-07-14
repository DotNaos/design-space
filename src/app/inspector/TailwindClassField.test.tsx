import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type { TailwindIntelligence } from "../../shared/contracts";
import { runLocalOperation } from "../api";
import { TailwindClassField } from "./TailwindClassField";

vi.mock("../api", () => ({ runLocalOperation: vi.fn() }));
const runLocalOperationMock = vi.mocked(runLocalOperation);

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  runLocalOperationMock.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("shows official suggestions and accepts the active replacement with Tab", async () => {
  const onChange = vi.fn();
  runLocalOperationMock.mockResolvedValue({
    value: "flex p",
    cursor: 6,
    engineVersion: "0.14.29",
    diagnostics: [],
    completions: [{ label: "p-4", insertText: "p-4", replaceStart: 5, replaceEnd: 6 }],
  } satisfies TailwindIntelligence as never);
  const view = render(<TailwindClassField value="flex p" onChange={onChange} />);
  const input = screen.getByRole("combobox", { name: "Tailwind classes" });
  fireEvent.focus(input);
  fireEvent.select(input, { target: { selectionStart: 6 } });
  await act(() => vi.advanceTimersByTimeAsync(100));
  expect(await screen.findByRole("option", { name: "p-4" })).toBeInTheDocument();
  await userEvent.keyboard("{Tab}");
  expect(onChange).toHaveBeenCalledWith("flex p-4");
  view.unmount();
  vi.useRealTimers();
});

it("does not accept a completion generated for the previous cursor position", async () => {
  const onChange = vi.fn();
  runLocalOperationMock.mockResolvedValue({
    value: "flex p",
    cursor: 6,
    engineVersion: "0.14.29",
    diagnostics: [],
    completions: [{ label: "p-4", insertText: "p-4", replaceStart: 5, replaceEnd: 6 }],
  } satisfies TailwindIntelligence as never);
  render(<TailwindClassField value="flex p" onChange={onChange} />);
  const input = screen.getByRole("combobox", { name: "Tailwind classes" });

  fireEvent.focus(input);
  fireEvent.select(input, { target: { selectionStart: 6 } });
  await act(() => vi.advanceTimersByTimeAsync(100));
  expect(await screen.findByRole("option", { name: "p-4" })).toBeInTheDocument();

  fireEvent.select(input, { target: { selectionStart: 0 } });
  fireEvent.keyDown(input, { key: "Tab" });

  expect(screen.queryByRole("option", { name: "p-4" })).not.toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
  vi.useRealTimers();
});

it("discards stale responses and surfaces diagnostics for the current value", async () => {
  const onChange = vi.fn();
  runLocalOperationMock.mockResolvedValue({
    value: "p-4 p-6",
    cursor: 7,
    engineVersion: "0.14.29",
    completions: [],
    diagnostics: [{ message: "Utilities conflict", severity: "warning", start: 0, end: 7 }],
  } satisfies TailwindIntelligence as never);
  render(<TailwindClassField value="p-4 p-6" onChange={onChange} />);
  fireEvent.focus(screen.getByRole("combobox", { name: "Tailwind classes" }));
  await act(() => vi.advanceTimersByTimeAsync(100));
  expect(await screen.findByText("Utilities conflict")).toBeInTheDocument();
  vi.useRealTimers();
});

it("keeps IntelliSense active when the field is refocused before the delayed blur closes it", async () => {
  runLocalOperationMock.mockResolvedValue({
    value: "p-",
    cursor: 2,
    engineVersion: "0.14.29",
    diagnostics: [],
    completions: [{ label: "p-4", insertText: "p-4", replaceStart: 0, replaceEnd: 2 }],
  } satisfies TailwindIntelligence as never);
  render(<TailwindClassField value="p-" onChange={() => undefined} />);
  const input = screen.getByRole("combobox", { name: "Tailwind classes" });

  fireEvent.focus(input);
  fireEvent.blur(input);
  fireEvent.focus(input);
  await act(() => vi.advanceTimersByTimeAsync(150));

  expect(await screen.findByRole("option", { name: "p-4" })).toBeInTheDocument();
  vi.useRealTimers();
});
