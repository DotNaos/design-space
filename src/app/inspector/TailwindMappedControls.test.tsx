import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { replaceTailwindUtilityGroup, snapSliderIndex, TailwindMappedControls } from "./TailwindMappedControls";
import { readBoxValue, setBoxValue, snapBoxPixels, TailwindBoxModelControl } from "./TailwindBoxModelControl";

afterEach(cleanup);

describe("replaceTailwindUtilityGroup", () => {
  it("replaces in place while preserving unrelated token order", () => {
    expect(replaceTailwindUtilityGroup(
      "flex flex-row p-4 text-sm",
      ["flex-row", "flex-col"],
      "flex-col",
    )).toBe("flex flex-col p-4 text-sm");
  });

  it("mutates only base utilities and preserves modifier variants", () => {
    const padding = (utility: string) => /^p-.+$/.test(utility);

    expect(replaceTailwindUtilityGroup(
      "flex p-4 sm:p-8 hover:p-2 dark:p-3 text-sm",
      ["p-4", "p-6"],
      "p-6",
      padding,
    )).toBe("flex p-6 sm:p-8 hover:p-2 dark:p-3 text-sm");

    expect(replaceTailwindUtilityGroup(
      "flex p-4 sm:p-8 hover:p-2 text-sm",
      ["p-4", "p-6"],
      "",
      padding,
    )).toBe("flex sm:p-8 hover:p-2 text-sm");
  });

  it("keeps arbitrary variants intact", () => {
    expect(replaceTailwindUtilityGroup(
      "grid supports-[display:grid]:grid [&>svg]:grid p-4",
      ["grid", "flex"],
      "flex",
      (utility) => /^(?:grid|flex)$/.test(utility),
    )).toBe("flex supports-[display:grid]:grid [&>svg]:grid p-4");
  });

  it("preserves importance when changing a base utility", () => {
    const padding = (utility: string) => /^p-.+$/.test(utility);
    expect(replaceTailwindUtilityGroup("!p-4 text-sm", ["p-4", "p-6"], "p-6", padding)).toBe("!p-6 text-sm");
    expect(replaceTailwindUtilityGroup("p-4! text-sm", ["p-4", "p-6"], "p-6", padding)).toBe("p-6! text-sm");
  });
});

describe("TailwindMappedControls", () => {
  it("renders one visible track marker for Auto and every spacing token", () => {
    const { container } = render(<TailwindMappedControls value="gap-4" onChange={vi.fn()} />);
    const track = container.querySelector('[data-slider-group="gap"]');
    const ticks = [...(track?.querySelectorAll<HTMLElement>("[data-slider-step]") ?? [])];

    expect(ticks.map((tick) => tick.dataset.sliderStep)).toEqual([
      "auto", "gap-0", "gap-1", "gap-2", "gap-3", "gap-4", "gap-5", "gap-6", "gap-7", "gap-8",
    ]);
    expect(ticks[0]).toHaveStyle({ left: "0%" });
    expect(ticks.at(-1)).toHaveStyle({ left: "100%" });
    expect(ticks.every((tick) => tick.classList.contains("top-[23px]"))).toBe(true);
    expect(ticks.every((tick) => tick.classList.contains("w-1.5") && tick.classList.contains("h-0.5"))).toBe(true);
    expect(track?.querySelector('[data-slider-thumb-shape="horizontal-pill"]')).toBeInTheDocument();
    expect(track).toHaveClass("mx-3.5", "w-[calc(100%-1.75rem)]");
  });

  it("uses sparse semantic labels beneath appearance slider tracks", () => {
    const { container } = render(<TailwindMappedControls value="rounded-md opacity-50 shadow-md" onChange={vi.fn()} />);

    const labels = [...container.querySelectorAll<HTMLElement>('[data-slider-labels="radius"] [data-slider-label]')];
    expect(labels.map((label) => label.textContent)).toEqual(["Auto", "Small", "Medium", "XL", "Full"]);
    expect(labels[0]).toHaveStyle({ left: "0%", transform: "none" });
    expect(labels.at(-1)).toHaveStyle({ left: "100%", transform: "translateX(-100%)" });
  });

  it("previews continuous appearance slider motion and commits only on release", () => {
    const onChange = vi.fn();
    const onPreviewChange = vi.fn();
    render(
      <TailwindMappedControls
        value="rounded-none"
        onChange={onChange}
        onPreviewChange={onPreviewChange}
      />,
    );

    const slider = screen.getByRole("slider", { name: "Radius" });
    for (const value of ["2", "4", "6"]) fireEvent.change(slider, { target: { value } });

    expect(onChange).not.toHaveBeenCalled();
    expect(onPreviewChange).toHaveBeenLastCalledWith("rounded-xl");

    fireEvent.blur(slider);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith("rounded-xl");
  });

  it("uses direct icon controls for width and height instead of size dropdowns", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<TailwindMappedControls value="w-full h-screen" onChange={onChange} />);

    expect(container.querySelectorAll("[data-size-mode-controls] select")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Width: Full" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Width: Full" })).toHaveClass("!bg-[#2997ff]", "h-9", "w-full", "rounded-xl");
    expect(screen.getByRole("button", { name: "Height: Screen" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("button", { name: /^(Width|Height):/ })).toHaveLength(14);
    expect(container.querySelector('[data-editor-icon-tabs="Width size modes"]')).toHaveClass("gap-0", "rounded-xl");
    expect(container.querySelector('[data-editor-icon-tabs="Display options"]')).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Width: Fit content" }));
    expect(onChange).toHaveBeenLastCalledWith("w-fit h-screen");
  });

  it.each([
    ["Gap", "gap"],
    ["Gap X", "gap-x"],
    ["Gap Y", "gap-y"],
  ])("emits only named Tailwind spacing tokens for %s", (name, prefix) => {
    for (let index = 0; index <= 9; index += 1) {
      const onChange = vi.fn();
      const initialValue = index === 0 ? `${prefix}-1` : `${prefix}-[13px]`;
      const { unmount } = render(<TailwindMappedControls value={initialValue} onChange={onChange} />);
      moveSlider(name, index);
      const emitted = onChange.mock.lastCall?.[0] as string;
      expect(emitted).toBe(index === 0 ? "" : `${prefix}-${index - 1}`);
      expect(emitted).not.toContain("[");
      unmount();
    }
  });

  it("moves exactly one named token per Arrow key and keeps Home/End semantics", () => {
    const onChange = vi.fn();
    function Harness() {
      const [value, setValue] = useState("flex gap-2");
      return <TailwindMappedControls value={value} onChange={(next) => { setValue(next); onChange(next); }} />;
    }
    render(<Harness />);
    const slider = screen.getByRole("slider", { name: "Gap" });

    fireEvent.keyDown(slider, { key: "ArrowRight", code: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith("flex gap-3");
    fireEvent.keyDown(slider, { key: "Home", code: "Home" });
    expect(onChange).toHaveBeenLastCalledWith("flex");
    fireEvent.keyDown(slider, { key: "End", code: "End" });
    expect(onChange).toHaveBeenLastCalledWith("flex gap-8");
  });

  it("uses accessible icon segments for common layout choices", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TailwindMappedControls value="grid sm:flex p-4" onChange={onChange} />);

    const flex = screen.getByRole("button", { name: "Display: Flex" });
    expect(screen.getByRole("button", { name: "Display: Grid" })).toHaveAttribute("aria-pressed", "true");
    await user.click(flex);

    expect(onChange).toHaveBeenCalledWith("flex sm:flex p-4");
  });

  it("previews a hovered layout choice without applying it", () => {
    const onChange = vi.fn();
    const onPreviewChange = vi.fn();
    render(<TailwindMappedControls value="block p-4" onChange={onChange} onPreviewChange={onPreviewChange} />);

    const flex = screen.getByRole("button", { name: "Display: Flex" });
    fireEvent.pointerEnter(flex);
    expect(onPreviewChange).toHaveBeenCalledWith("flex p-4");
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.pointerLeave(flex);
    expect(onPreviewChange).toHaveBeenLastCalledWith();
  });

  it("replaces valid display utilities that are not exposed as visual presets", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TailwindMappedControls value="table-cell p-4" onChange={onChange} />);

    expect(screen.getByText("Custom · table-cell")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Display: Flex" }));

    expect(onChange).toHaveBeenCalledWith("flex p-4");
  });

  it("uses a compact 3×3 alignment control and omits the default left utility", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TailwindMappedControls value="flex items-center-safe justify-center-safe gap-4" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Alignment: Top Left" }));
    expect(onChange).toHaveBeenCalledWith("flex items-start gap-4");
  });

  it("shows only controls relevant to the selected display mode", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<TailwindMappedControls value="block" onChange={onChange} />);

    expect(screen.queryByText("Direction")).not.toBeInTheDocument();
    expect(screen.queryByText("Alignment")).not.toBeInTheDocument();

    rerender(<TailwindMappedControls value="flex" onChange={onChange} />);
    expect(screen.getByText("Direction")).toBeInTheDocument();
    expect(screen.getByText("Alignment")).toBeInTheDocument();

    rerender(<TailwindMappedControls value="grid" onChange={onChange} />);
    expect(screen.queryByText("Direction")).not.toBeInTheDocument();
    expect(screen.getByText("Columns")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Alignment: Middle Center" }));
    expect(onChange).toHaveBeenLastCalledWith("grid items-center justify-center");
  });

  it("hides ineffective gap controls for non-layout elements", () => {
    render(<TailwindMappedControls value="contents p-4" onChange={vi.fn()} />);

    expect(screen.queryByRole("slider", { name: "Gap" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Drag padding top · 16px" })).toBeInTheDocument();
  });

  it("keeps gap controls and the box model independent", () => {
    const onChange = vi.fn();
    render(<TailwindMappedControls value="gap-4 gap-x-2 gap-y-3 p-4 px-8 py-2" onChange={onChange} />);

    moveSlider("Gap", 7);
    expect(onChange).toHaveBeenCalledWith("gap-6 gap-x-2 gap-y-3 p-4 px-8 py-2");
    expect(screen.getByRole("button", { name: "Drag padding top · 8px" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Drag padding right · 32px" })).toBeInTheDocument();
  });

  it("does not let uniform appearance controls consume directional utilities", () => {
    const onChange = vi.fn();
    render(<TailwindMappedControls value="rounded-t-lg rounded-[18px] border-white/10" onChange={onChange} />);

    expect(screen.getByText("Custom · rounded-[18px]")).toBeInTheDocument();
    moveSlider("Radius", 4);

    expect(onChange).toHaveBeenCalledWith("rounded-t-lg rounded-md border-white/10");
  });

  it("preserves arbitrary shadow colors when changing shadow size", () => {
    const onChange = vi.fn();
    render(<TailwindMappedControls value="shadow-lg shadow-[#50d71e] border-white/10" onChange={onChange} />);

    moveSlider("Shadow", 4);

    expect(onChange).toHaveBeenCalledWith("shadow-md shadow-[#50d71e] border-white/10");
  });

  it.each(["shadow-(--my-shadow)", "shadow-[none]", "shadow-[inherit]"])(
    "replaces custom shadow size %s without leaving a conflicting utility",
    (customShadow) => {
      const onChange = vi.fn();
      render(<TailwindMappedControls value={`${customShadow} shadow-[#50d71e]`} onChange={onChange} />);

      moveSlider("Shadow", 4);

      expect(onChange).toHaveBeenCalledWith("shadow-md shadow-[#50d71e]");
    },
  );
});

describe("Tailwind box model", () => {
  it("renders the CSS box model as nested margin, border, padding, and content layers", () => {
    const { container } = render(<TailwindBoxModelControl value="p-4 border m-2" onChange={vi.fn()} />);
    const margin = container.querySelector<HTMLElement>('[data-box-model-layer="margin"]');
    const border = container.querySelector<HTMLElement>('[data-box-model-layer="border"]');
    const padding = container.querySelector<HTMLElement>('[data-box-model-layer="padding"]');

    expect(margin).toContainElement(border);
    expect(border).toContainElement(padding);
    expect(screen.getByLabelText("Content box")).toBeInTheDocument();
    // Equal sides use the quick Tailwind ladder; exact fields are available from the detail button.
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    for (const kind of ["margin", "border", "padding"]) {
      expect(screen.getByRole("slider", { name: `${kind} all sides Tailwind value` })).toBeInTheDocument();
      expect(container.querySelector(`[data-box-kind-icon="${kind}"]`)).toBeInTheDocument();
    }
    expect(screen.getAllByRole("button", { name: /^Drag / })).toHaveLength(12);
    expect(screen.getByLabelText("Box model legend")).toHaveTextContent(/margin.*border.*padding/);
    for (const edge of ["margin:top", "border:top", "padding:top"]) {
      expect(container.querySelector(`[data-box-model-edge="${edge}"]`)).toHaveAttribute("data-box-edge-appearance", "scaled");
    }
  });

  it("marks zero sides as empty instead of presenting them as sized bands", () => {
    const { container } = render(<TailwindBoxModelControl value="pt-0 border-r-0" onChange={vi.fn()} />);

    expect(container.querySelector('[data-box-model-edge="margin:left"]')).toHaveAttribute("data-box-edge-appearance", "empty");
    expect(container.querySelector('[data-box-model-edge="border:right"]')).toHaveAttribute("data-box-edge-appearance", "empty");
    expect(container.querySelector('[data-box-model-edge="padding:top"]')).toHaveAttribute("data-box-edge-appearance", "empty");
  });

  it("draws every ring as an even solid outline regardless of per-side values", () => {
    const { container } = render(<TailwindBoxModelControl value="pt-6 pb-1 m-[var(--space)]" onChange={vi.fn()} />);

    for (const kind of ["margin", "border", "padding"]) {
      const style = getComputedStyle(container.querySelector<HTMLElement>(`[data-box-model-layer="${kind}"]`)!);
      expect([style.borderTopStyle, style.borderRightStyle, style.borderBottomStyle, style.borderLeftStyle])
        .toEqual(["solid", "solid", "solid", "solid"]);
      expect([style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth])
        .toEqual([style.borderTopWidth, style.borderTopWidth, style.borderTopWidth]);
      expect([style.borderRightColor, style.borderBottomColor, style.borderLeftColor])
        .toEqual([style.borderTopColor, style.borderTopColor, style.borderTopColor]);
    }
  });

  it("encodes a single side in the thickness of its full-length bar", () => {
    const { container } = render(<TailwindBoxModelControl value="pt-1 pr-6 pb-24 pl-0" onChange={vi.fn()} />);
    const bar = (side: string) => Number(
      container.querySelector(`[data-box-model-edge="padding:${side}"]`)?.getAttribute("data-box-bar-thickness"),
    );

    expect(bar("left")).toBeLessThan(bar("top"));
    expect(bar("top")).toBeLessThan(bar("right"));
    expect(bar("right")).toBeLessThan(bar("bottom"));

    // The layer reserves its complete visual range even when one side is zero.
    expect(container.querySelector('[data-box-model-layer="padding"]')).toHaveAttribute("data-box-band-thickness", "14");
  });

  it("edits the same value from the fields as from the diagram", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    function Harness() {
      const [value, setValue] = useState("p-4");
      return <TailwindBoxModelControl value={value} onChange={(next) => { setValue(next); onChange(next); }} />;
    }
    render(<Harness />);

    // The default control walks the finite Tailwind ladder for all four sides.
    const paddingSlider = screen.getByRole("slider", { name: "padding all sides Tailwind value" });
    fireEvent.change(paddingSlider, {
      target: { value: "10" },
    });
    fireEvent.blur(paddingSlider);
    expect(onChange).toHaveBeenLastCalledWith("p-10");

    // Fine tuning deliberately reveals the exact field and permits arbitrary values.
    await user.click(screen.getByRole("button", { name: "Use custom padding values" }));
    const linked = screen.getByRole("textbox", { name: "padding all sides" });
    expect(linked).toHaveValue("10");
    expect(linked.closest("[data-box-value-field]")).toHaveClass("h-8");
    await user.clear(linked);
    await user.type(linked, "22px{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("p-[22px]");

    // Splitting exposes one larger field per side, which writes only that side.
    await user.click(screen.getByRole("button", { name: "Edit padding sides separately" }));
    const top = screen.getByRole("textbox", { name: "padding top" });
    expect(top).toHaveValue("5.5");
    await user.clear(top);
    await user.type(top, "8px{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("p-[22px] pt-2");

    // Arrows walk the same ladder the drag uses, for nudging without retyping.
    await user.keyboard("{ArrowUp}");
    expect(onChange).toHaveBeenLastCalledWith("p-[22px] pt-3");
  });

  it("keeps slider motion local and commits only the final value", () => {
    const onChange = vi.fn();
    const onBoxModelPreviewChange = vi.fn();
    const onPreviewChange = vi.fn();
    render(
      <TailwindBoxModelControl
        value="p-4"
        onChange={onChange}
        onBoxModelPreviewChange={onBoxModelPreviewChange}
        onPreviewChange={onPreviewChange}
      />,
    );

    const slider = screen.getByRole("slider", { name: "padding all sides Tailwind value" });
    for (const value of ["5", "7", "10"]) {
      fireEvent.change(slider, { target: { value } });
    }

    expect(onChange).not.toHaveBeenCalled();
    expect(onPreviewChange).toHaveBeenLastCalledWith("p-10");
    expect(onBoxModelPreviewChange).toHaveBeenLastCalledWith({
      className: "p-10",
      kind: "padding",
    });

    fireEvent.blur(slider);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith("p-10");
  });

  it("snaps typed standard values to the nearest Tailwind step", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    function Harness() {
      const [value, setValue] = useState("p-4 pt-8");
      return <TailwindBoxModelControl value={value} onChange={(next) => { setValue(next); onChange(next); }} />;
    }
    render(<Harness />);

    const left = screen.getByRole("textbox", { name: "padding left" });
    await user.clear(left);
    await user.type(left, "7px{Enter}");

    expect(onChange).toHaveBeenLastCalledWith("p-4 pt-8 pl-2");
    expect(screen.getByRole("textbox", { name: "padding left" })).toHaveValue("2");
  });

  it("does not let sliders or exact fields create negative spacing", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    function Harness() {
      const [value, setValue] = useState("m-2 p-2");
      return <TailwindBoxModelControl value={value} onChange={(next) => { setValue(next); onChange(next); }} />;
    }
    render(<Harness />);

    const marginSlider = screen.getByRole("slider", { name: "margin all sides Tailwind value" });
    fireEvent.change(marginSlider, {
      target: { value: "-1" },
    });
    fireEvent.blur(marginSlider);
    expect(onChange).toHaveBeenLastCalledWith("m-0 p-2");

    await user.click(screen.getByRole("button", { name: "Use custom padding values" }));
    const padding = screen.getByRole("textbox", { name: "padding all sides" });
    await user.clear(padding);
    await user.type(padding, "-3{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("m-0 p-0");
  });

  it("splits a row automatically while its sides disagree", () => {
    render(<TailwindBoxModelControl value="p-4 pt-8" onChange={vi.fn()} />);

    // Padding cannot be shown as one number, so it opens split and refuses to be re-linked blindly.
    expect(screen.getByRole("textbox", { name: "padding top" })).toHaveValue("8");
    expect(screen.getByRole("textbox", { name: "padding left" })).toHaveValue("4");
    // The other rows stay on their faster all-sides Tailwind sliders.
    expect(screen.getByRole("slider", { name: "margin all sides Tailwind value" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "border all sides Tailwind value" })).toBeInTheDocument();
  });

  it("uses Tailwind units by default and switches the whole control to rem or pixels", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<TailwindBoxModelControl value="p-4" onChange={onChange} />);

    expect(screen.getByRole("tab", { name: "Tailwind spacing · 1 = 4 px" })).toHaveAttribute("aria-selected", "true");
    expect(container.querySelector('[data-box-slider-output="padding"]')).toHaveTextContent("4");

    await user.click(screen.getByRole("tab", { name: "Rem units · 1 rem = 16 px" }));
    expect(screen.getByRole("slider", { name: "padding all sides rem value" })).toBeInTheDocument();
    expect(container.querySelector('[data-box-slider-output="padding"]')).toHaveTextContent("1 rem");

    await user.click(screen.getByRole("tab", { name: "Pixels" }));
    expect(screen.getByRole("slider", { name: "padding all sides px value" })).toBeInTheDocument();
    expect(container.querySelector('[data-box-slider-output="padding"]')).toHaveTextContent("16 px");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("interprets exact fields in the selected unit while keeping canonical Tailwind output", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    function Harness() {
      const [value, setValue] = useState("p-4 pt-8");
      return <TailwindBoxModelControl value={value} onChange={(next) => { setValue(next); onChange(next); }} />;
    }
    render(<Harness />);

    await user.click(screen.getByRole("tab", { name: "Rem units · 1 rem = 16 px" }));
    const left = screen.getByRole("textbox", { name: "padding left" });
    expect(left).toHaveValue("1 rem");
    await user.clear(left);
    await user.type(left, "1.25{Enter}");

    expect(onChange).toHaveBeenLastCalledWith("p-4 pt-8 pl-5");
    expect(screen.getByRole("textbox", { name: "padding left" })).toHaveValue("1.25 rem");
  });

  it("highlights the matching ring while a field has focus", async () => {
    const user = userEvent.setup();
    const { container } = render(<TailwindBoxModelControl value="p-4 m-4" onChange={vi.fn()} />);
    const bar = (edge: string) => Number(
      container.querySelector(`[data-box-model-edge="${edge}"]`)?.getAttribute("data-box-bar-thickness"),
    );
    const resting = bar("padding:top");

    await user.click(screen.getByRole("slider", { name: "padding all sides Tailwind value" }));

    expect(bar("padding:top")).toBeGreaterThan(resting);
    expect(bar("margin:top")).toBe(resting);
  });

  it("keeps one fixed footprint so a spacing edit never moves the panel below it", () => {
    const footprint = (value: string) => {
      const { container, unmount } = render(<TailwindBoxModelControl value={value} onChange={vi.fn()} />);
      const content = Number(container.querySelector('[aria-label="Content box"]')?.getAttribute("data-box-content-height"));
      const bands = ["margin", "border", "padding"].reduce((total, kind) => total + Number(
        container.querySelector(`[data-box-model-layer="${kind}"]`)?.getAttribute("data-box-band-thickness"),
      ), 0);
      unmount();
      return { bands, content, total: content + bands * 2 };
    };

    const empty = footprint("");
    const large = footprint("p-24 m-24 border-8");
    // Every layer reserves its maximum track and the content stays fixed as values change.
    expect(large.bands).toBe(empty.bands);
    expect(large.content).toBe(empty.content);
    expect(large.total).toBe(empty.total);
    expect(footprint("p-4 border m-2").total).toBe(empty.total);
  });

  it("keeps the layer track fixed while its value fill changes", () => {
    const geometry = (value: string) => {
      const { container, unmount } = render(<TailwindBoxModelControl value={value} onChange={vi.fn()} />);
      const track = Number(
        container.querySelector('[data-box-model-layer="padding"]')?.getAttribute("data-box-band-thickness"),
      );
      const top = Number(
        container.querySelector('[data-box-model-edge="padding:top"]')?.getAttribute("data-box-bar-thickness"),
      );
      unmount();
      return { top, track };
    };

    const regular = geometry("p-4");
    const large = geometry("p-4 pt-24");
    const small = geometry("p-4 pt-1");
    expect([large.track, small.track]).toEqual([regular.track, regular.track]);
    expect(large.top).toBeGreaterThan(regular.top);
    expect(small.top).toBeLessThan(regular.top);
  });

  it("marks values outside the pixel ladder as custom", () => {
    const { container } = render(<TailwindBoxModelControl value="m-auto p-[var(--space)]" onChange={vi.fn()} />);

    expect(container.querySelector('[data-box-model-edge="margin:top"]')).toHaveAttribute("data-box-edge-appearance", "custom");
    expect(container.querySelector('[data-box-model-edge="padding:top"]')).toHaveAttribute("data-box-edge-appearance", "custom");
  });

  it("snaps dragged pixel values to Tailwind increments", () => {
    const onChange = vi.fn();
    function Harness() {
      const [value, setValue] = useState("p-4");
      return <TailwindBoxModelControl value={value} onChange={(next) => { setValue(next); onChange(next); }} />;
    }
    render(<Harness />);

    const handle = screen.getByRole("button", { name: "Drag padding top · 16px" });
    dispatchBoxPointer(handle, "pointerdown", 1, 0, 100);
    dispatchBoxPointer(window, "pointermove", 1, 0, 84);
    expect(document.querySelector('[data-box-model-edge="padding:top"]')).toHaveAttribute("data-box-edge-dragging", "true");
    expect(Number(document.querySelector('[data-box-model-edge="padding:top"]')?.getAttribute("data-box-edge-thickness"))).toBeGreaterThan(2);
    dispatchBoxPointer(window, "pointerup", 1, 0, 84);

    expect(onChange).toHaveBeenLastCalledWith("p-4 pt-6");
    expect(screen.getByRole("button", { name: "Drag padding top · 24px" })).toBeInTheDocument();
    expect(document.querySelector('[data-box-model-edge="padding:top"]')).not.toHaveAttribute("data-box-edge-dragging");
  });

  it("grows a side by dragging away from the content and shrinks it by dragging inward", () => {
    const onChange = vi.fn();
    function Harness() {
      const [value, setValue] = useState("p-4");
      return <TailwindBoxModelControl value={value} onChange={(next) => { setValue(next); onChange(next); }} />;
    }
    render(<Harness />);

    // The bottom edge grows downward and the left edge grows leftward: both point away from the centre.
    const bottom = screen.getByRole("button", { name: "Drag padding bottom · 16px" });
    dispatchBoxPointer(bottom, "pointerdown", 1, 0, 100);
    dispatchBoxPointer(window, "pointermove", 1, 0, 116);
    dispatchBoxPointer(window, "pointerup", 1, 0, 116);
    expect(onChange).toHaveBeenLastCalledWith("p-4 pb-6");

    const left = screen.getByRole("button", { name: "Drag padding left · 16px" });
    dispatchBoxPointer(left, "pointerdown", 2, 100, 0);
    dispatchBoxPointer(window, "pointermove", 2, 84, 0);
    dispatchBoxPointer(window, "pointerup", 2, 84, 0);
    expect(onChange).toHaveBeenLastCalledWith("p-4 pb-6 pl-6");

    // Reversing the same gesture walks back down the ladder.
    const top = screen.getByRole("button", { name: "Drag padding top · 16px" });
    dispatchBoxPointer(top, "pointerdown", 3, 0, 100);
    dispatchBoxPointer(window, "pointermove", 3, 0, 116);
    dispatchBoxPointer(window, "pointerup", 3, 0, 116);
    expect(onChange).toHaveBeenLastCalledWith("p-4 pb-6 pl-6 pt-2");
  });

  it("holds the current rung until the pointer clears the detent", () => {
    const onChange = vi.fn();
    const onPreviewChange = vi.fn();
    function Harness() {
      const [value, setValue] = useState("p-4");
      return (
        <TailwindBoxModelControl
          value={value}
          onChange={(next) => { setValue(next); onChange(next); }}
          onPreviewChange={onPreviewChange}
        />
      );
    }
    render(<Harness />);

    const handle = screen.getByRole("button", { name: "Drag padding top · 16px" });
    dispatchBoxPointer(handle, "pointerdown", 1, 0, 100);

    // Half a step of travel sits inside the deadband: the value must not move at all.
    dispatchBoxPointer(window, "pointermove", 1, 0, 96);
    expect(onChange).not.toHaveBeenCalled();

    // Past the detent it clicks over to exactly one rung.
    dispatchBoxPointer(window, "pointermove", 1, 0, 94);
    expect(onChange).not.toHaveBeenCalled();
    expect(onPreviewChange).toHaveBeenLastCalledWith("p-4 pt-5");

    // Same pointer position as the held move above, but now approached from the other side: it
    // stays on the new rung instead of flickering back. That asymmetry is the detent.
    dispatchBoxPointer(window, "pointermove", 1, 0, 96);
    expect(onChange).not.toHaveBeenCalled();

    dispatchBoxPointer(window, "pointerup", 1, 0, 96);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith("p-4 pt-5");
  });

  it("resizes all four sides when a corner is dragged outward", () => {
    const onChange = vi.fn();
    function Harness() {
      const [value, setValue] = useState("p-4 text-sm");
      return <TailwindBoxModelControl value={value} onChange={(next) => { setValue(next); onChange(next); }} />;
    }
    render(<Harness />);

    expect(screen.getAllByRole("button", { name: /^Resize / })).toHaveLength(12);
    const corner = screen.getByRole("button", { name: "Resize padding on all sides from top left · 16px" });
    dispatchBoxPointer(corner, "pointerdown", 1, 100, 100);
    dispatchBoxPointer(window, "pointermove", 1, 92, 92);
    expect(document.querySelector('[data-box-model-corner="padding:topLeft"]')).toHaveAttribute("data-box-corner-dragging", "true");
    dispatchBoxPointer(window, "pointerup", 1, 92, 92);

    expect(onChange).toHaveBeenLastCalledWith("p-5 text-sm");
    for (const side of ["top", "right", "bottom", "left"]) {
      expect(screen.getByRole("button", { name: `Drag padding ${side} · 20px` })).toBeInTheDocument();
    }
  });

  it("grows the hovered bar so it is easier to see and grab", async () => {
    const user = userEvent.setup();
    const { container } = render(<TailwindBoxModelControl value="p-4" onChange={vi.fn()} />);
    const bar = () => Number(
      container.querySelector('[data-box-model-edge="padding:top"]')?.getAttribute("data-box-bar-thickness"),
    );
    const band = () => container.querySelector('[data-box-model-layer="padding"]')?.getAttribute("data-box-band-thickness");
    const resting = bar();
    const restingBand = band();

    const restingContent = container.querySelector('[aria-label="Content box"]')?.getAttribute("data-box-content-height");

    await user.hover(screen.getByRole("button", { name: "Drag padding top · 16px" }));
    expect(bar()).toBeGreaterThan(resting);
    // Highlighting one side must not disturb the outline shared by all four…
    expect(band()).toBe(restingBand);
    // …and above all it must not resize the diagram, or the whole panel would jump on hover.
    expect(container.querySelector('[aria-label="Content box"]')?.getAttribute("data-box-content-height")).toBe(restingContent);

    await user.unhover(screen.getByRole("button", { name: "Drag padding top · 16px" }));
    expect(bar()).toBe(resting);
  });

  it("reveals the corner grab handles as soon as anywhere on the ring is hovered", async () => {
    const user = userEvent.setup();
    const { container } = render(<TailwindBoxModelControl value="p-4 m-4" onChange={vi.fn()} />);
    const bracket = (kind: string, corner: string) => getComputedStyle(
      container.querySelector(`[data-box-model-corner="${kind}:${corner}"]`)!.firstElementChild!,
    ).opacity;

    expect(bracket("padding", "bottomRight")).toBe("0");

    // Hovering a side, not the corner itself, still has to advertise the corners of that ring.
    await user.hover(screen.getByRole("button", { name: "Drag padding top · 16px" }));
    expect(Number(bracket("padding", "bottomRight"))).toBeGreaterThan(0);
    expect(bracket("margin", "bottomRight")).toBe("0");

    // Grabbing a corner resizes all four sides, so all four brackets go to full strength together.
    const fromSideHover = Number(bracket("padding", "bottomRight"));
    await user.hover(screen.getByRole("button", { name: "Resize padding on all sides from top left · 16px" }));
    expect(Number(bracket("padding", "topLeft"))).toBeGreaterThan(fromSideHover);
    expect(bracket("padding", "bottomRight")).toBe(bracket("padding", "topLeft"));
  });

  it("grows every bar of a ring while its corner is hovered", async () => {
    const user = userEvent.setup();
    const { container } = render(<TailwindBoxModelControl value="p-4 m-4" onChange={vi.fn()} />);
    const bar = (edge: string) => Number(
      container.querySelector(`[data-box-model-edge="${edge}"]`)?.getAttribute("data-box-bar-thickness"),
    );
    const resting = bar("padding:right");

    await user.hover(screen.getByRole("button", { name: "Resize padding on all sides from top left · 16px" }));

    expect(bar("padding:top")).toBeGreaterThan(resting);
    expect(bar("padding:right")).toBeGreaterThan(resting);
    expect(bar("padding:bottom")).toBeGreaterThan(resting);
    expect(bar("padding:left")).toBeGreaterThan(resting);
    expect(bar("margin:top")).toBe(resting);
  });

  it("opens an exact input only after double-clicking a value", async () => {
    const user = userEvent.setup();
    render(<TailwindBoxModelControl value="p-4" onChange={vi.fn()} />);

    expect(screen.queryByRole("textbox", { name: "padding top" })).not.toBeInTheDocument();
    await user.dblClick(screen.getByRole("button", { name: "Drag padding top · 16px" }));
    expect(screen.getByRole("textbox", { name: "padding top" })).toHaveValue("4");
  });

  it("reveals the exact value and its governing utility only while an edge is hovered", async () => {
    const user = userEvent.setup();
    const { container } = render(<TailwindBoxModelControl value="px-8 p-4" onChange={vi.fn()} />);
    const content = container.querySelector('[aria-label="Content box"]');

    expect(content?.querySelector("[data-box-model-readout]")).not.toBeInTheDocument();
    await user.hover(screen.getByRole("button", { name: "Drag padding top · 16px" }));
    expect(content?.querySelector('[data-box-model-readout]')).toHaveTextContent("padding top4p-4");
    expect(screen.getByText("p-4")).toBeVisible();

    await user.hover(screen.getByRole("button", { name: "Drag padding right · 32px" }));
    expect(content?.querySelector('[data-box-model-readout]')).toHaveTextContent("padding right8px-8");
    expect(screen.getByText("px-8")).toBeVisible();
  });

  it("steps one Tailwind increment per arrow key", () => {
    const onChange = vi.fn();
    render(<TailwindBoxModelControl value="p-4" onChange={onChange} />);
    const handle = screen.getByRole("button", { name: "Drag padding top · 16px" });

    fireEvent.keyDown(handle, { key: "ArrowUp" });
    expect(onChange).toHaveBeenLastCalledWith("p-4 pt-5");

    fireEvent.keyDown(handle, { key: "ArrowDown" });
    expect(onChange).toHaveBeenLastCalledWith("p-4 pt-3");
  });

  it("collapses every side into one shorthand while dragging with the all-sides modifier", () => {
    const onChange = vi.fn();
    function Harness() {
      const [value, setValue] = useState("p-4 pt-8 text-sm");
      return <TailwindBoxModelControl value={value} onChange={(next) => { setValue(next); onChange(next); }} />;
    }
    render(<Harness />);

    const handle = screen.getByRole("button", { name: "Drag padding top · 32px" });
    dispatchBoxPointer(handle, "pointerdown", 1, 0, 100, true);
    dispatchBoxPointer(window, "pointermove", 1, 0, 92, true);
    dispatchBoxPointer(window, "pointerup", 1, 0, 92, true);

    expect(onChange).toHaveBeenLastCalledWith("p-9 text-sm");
    for (const side of ["top", "right", "bottom", "left"]) {
      expect(screen.getByRole("button", { name: `Drag padding ${side} · 36px` })).toBeInTheDocument();
    }
  });

  it("keeps non-pixel values editable without pretending they are draggable", async () => {
    const user = userEvent.setup();
    render(<TailwindBoxModelControl value="m-auto" onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Drag margin top · auto" })).toHaveAttribute("aria-disabled", "true");
    await user.dblClick(screen.getByRole("button", { name: "Drag margin top · auto" }));
    expect(screen.getByRole("textbox", { name: "margin top" })).toHaveValue("auto");
  });

  it("uses Tailwind spacing and border scales for snapping", () => {
    expect(snapBoxPixels("padding", 18)).toBe(16);
    expect(snapBoxPixels("padding", 19)).toBe(20);
    expect(snapBoxPixels("border", 3.2)).toBe(4);
    expect(snapBoxPixels("padding", -10)).toBe(0);
    expect(snapBoxPixels("margin", -9)).toBe(0);
  });

  it("resolves side, axis, and uniform values in cascade order", () => {
    const value = "p-4 px-8 pt-[10px] m-[var(--space)] border border-r-2";
    expect(readBoxValue(value, "padding", "top")).toBe("10px");
    expect(readBoxValue(value, "padding", "right")).toBe("32px");
    expect(readBoxValue(value, "padding", "bottom")).toBe("16px");
    expect(readBoxValue(value, "margin", "left")).toBe("var(--space)");
    expect(readBoxValue(value, "border", "right")).toBe("2px");
  });

  it("writes one side without removing uniform or responsive utilities", () => {
    expect(setBoxValue("p-4 sm:pt-8 text-sm", "padding", "top", "12px"))
      .toBe("p-4 sm:pt-8 text-sm pt-3");
    expect(setBoxValue("m-4 mt-[12px] hover:mt-8", "margin", "top", "var(--space)"))
      .toBe("m-4 mt-[var(--space)] hover:mt-8");
  });

  it("preserves directional border colors when changing border width", () => {
    expect(setBoxValue("border-t-red-500 border-t-2 border-white/10", "border", "top", "4px"))
      .toBe("border-t-red-500 border-t-4 border-white/10");
  });

  it("clamps unsupported negative spacing edits to zero", () => {
    expect(setBoxValue("m-4", "margin", "top", "-8px")).toBe("m-4 mt-0");
    expect(setBoxValue("p-4", "padding", "left", "-0.5rem")).toBe("p-4 pl-0");
    expect(readBoxValue("m-4 mt-0", "margin", "top")).toBe("0");
  });
});

describe("snapSliderIndex", () => {
  it("rounds and clamps every incoming position to a deterministic option index", () => {
    expect(snapSliderIndex(undefined, 9)).toBe(0);
    expect(snapSliderIndex(Number.NaN, 9)).toBe(0);
    expect(snapSliderIndex(-3, 9)).toBe(0);
    expect(snapSliderIndex(2.49, 9)).toBe(2);
    expect(snapSliderIndex(2.5, 9)).toBe(3);
    expect(snapSliderIndex(99, 9)).toBe(9);
  });
});

function moveSlider(name: string, index: number) {
  const slider = screen.getByRole("slider", { name });
  fireEvent.change(slider, { target: { value: String(index) } });
  fireEvent.blur(slider);
}

function dispatchBoxPointer(target: Element | Node | Document | Window, type: string, pointerId: number, clientX: number, clientY: number, altKey = false) {
  const event = new MouseEvent(type, { altKey, bubbles: true, clientX, clientY });
  Object.defineProperty(event, "pointerId", { value: pointerId });
  fireEvent(target, event);
}
