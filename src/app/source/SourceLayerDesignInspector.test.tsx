import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import type { SourceWorkspaceLayer } from "../../shared/source-workspace";
import design from "./SourceLayerDesignInspector.design";
import { SourceLayerDesignInspector } from "./SourceLayerDesignInspector";
import type { SourceLayerClassEditor } from "./useSourceLayerClassEditor";

afterEach(cleanup);

const layer: SourceWorkspaceLayer = {
  id: "navigation",
  label: "nav",
  kind: "html",
  source: { start: 0, end: 48 },
  className: {
    start: 5,
    end: 31,
    syntax: "attribute",
    value: "flex h-full",
  },
  children: [],
};

it("renders its isolated design defaults without runtime context", () => {
  render(<>{design.render(design.defaults)}</>);

  expect(screen.getByRole("heading", { name: "Selected layer" })).toBeInTheDocument();
  expect(screen.getByLabelText("Generated Tailwind classes")).toHaveTextContent(
    "flex min-h-10 items-center",
  );
});

it("shows distinct Tailwind paint values and previews visual control output", () => {
  const change = vi.fn();
  const preview = vi.fn();
  const styleEditor = {
    binding: layer.className,
    change,
    changeText: vi.fn(),
    css: "",
    editable: true,
    error: undefined,
    previewCss: "",
    previewTextValue: undefined,
    previewValue: undefined,
    reset: vi.fn(),
    textBinding: undefined,
    textEditable: false,
    textValue: "",
    value: "flex h-full bg-black/20 border border-white/[0.06] text-sky-300/80",
  } as SourceLayerClassEditor;

  render(<SourceLayerDesignInspector layer={layer} styleEditor={styleEditor} onClassNamePreviewChange={preview} />);

  expect(screen.getByRole("textbox", { name: "Fill" })).toHaveValue("black/20");
  expect(screen.getByRole("textbox", { name: "Stroke" })).toHaveValue("white/[0.06]");
  expect(screen.getByRole("textbox", { name: "Text" })).toHaveValue("sky-300/80");

  fireEvent.pointerEnter(screen.getByRole("button", { name: "Display: Grid" }));
  expect(preview).toHaveBeenCalledWith("grid h-full bg-black/20 border border-white/[0.06] text-sky-300/80");
  fireEvent.pointerLeave(screen.getByRole("button", { name: "Display: Grid" }));
  expect(preview).toHaveBeenLastCalledWith();
});
