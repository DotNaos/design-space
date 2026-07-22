import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { replaceTailwindUtilityGroup, snapSliderIndex, TailwindMappedControls } from "./TailwindMappedControls";

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
  });

  it.each([
    ["Gap", "gap"],
    ["Gap X", "gap-x"],
    ["Gap Y", "gap-y"],
    ["Padding", "p"],
    ["Padding X", "px"],
    ["Padding Y", "py"],
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
      const [value, setValue] = useState("gap-2");
      return <TailwindMappedControls value={value} onChange={(next) => { setValue(next); onChange(next); }} />;
    }
    render(<Harness />);
    const slider = screen.getByRole("slider", { name: "Gap" });

    fireEvent.keyDown(slider, { key: "ArrowRight", code: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith("gap-3");
    fireEvent.keyDown(slider, { key: "Home", code: "Home" });
    expect(onChange).toHaveBeenLastCalledWith("");
    fireEvent.keyDown(slider, { key: "End", code: "End" });
    expect(onChange).toHaveBeenLastCalledWith("gap-8");
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

  it("replaces valid display utilities that are not exposed as visual presets", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TailwindMappedControls value="table-cell p-4" onChange={onChange} />);

    expect(screen.getByText("Custom · table-cell")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Display: Flex" }));

    expect(onChange).toHaveBeenCalledWith("flex p-4");
  });

  it("replaces safe alignment utilities without leaving conflicting classes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TailwindMappedControls value="flex items-center-safe justify-center-safe gap-4" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Align: Start" }));
    expect(onChange).toHaveBeenCalledWith("flex items-start justify-center-safe gap-4");

    onChange.mockClear();
    await user.click(screen.getByRole("button", { name: "Justify: End" }));
    expect(onChange).toHaveBeenCalledWith("flex items-center-safe justify-end gap-4");
  });

  it("turns on flex layout when a direction is chosen on a normal element", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TailwindMappedControls value="min-w-0" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Direction: Column" }));

    expect(onChange).toHaveBeenCalledWith("min-w-0 flex flex-col");
  });

  it("turns on flex layout for alignment but preserves an existing grid", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<TailwindMappedControls value="block" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Align: End" }));
    expect(onChange).toHaveBeenLastCalledWith("flex items-end");

    onChange.mockClear();
    rerender(<TailwindMappedControls value="grid" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Justify: Center" }));
    expect(onChange).toHaveBeenLastCalledWith("grid justify-center");
  });

  it("shows arbitrary base values as Custom and replaces them in place", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TailwindMappedControls value="flex p-[18px] sm:p-8 text-sm" onChange={onChange} />);

    expect(screen.getByText("Custom · p-[18px]")).toBeInTheDocument();
    moveSlider("Padding", 7);

    expect(onChange).toHaveBeenCalledWith("flex p-6 sm:p-8 text-sm");
  });

  it("edits uniform and axis spacing independently", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TailwindMappedControls value="gap-4 gap-x-2 gap-y-3 p-4 px-8 py-2" onChange={onChange} />);

    moveSlider("Gap", 7);
    expect(onChange).toHaveBeenCalledWith("gap-6 gap-x-2 gap-y-3 p-4 px-8 py-2");

    onChange.mockClear();
    moveSlider("Padding X", 4);
    expect(onChange).toHaveBeenCalledWith("gap-4 gap-x-2 gap-y-3 p-4 px-3 py-2");
  });

  it("does not let uniform appearance controls consume directional utilities", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TailwindMappedControls value="rounded-t-lg rounded-[18px] border-white/10" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Appearance" }));
    expect(screen.getByText("Custom · rounded-[18px]")).toBeInTheDocument();
    moveSlider("Radius", 4);

    expect(onChange).toHaveBeenCalledWith("rounded-t-lg rounded-md border-white/10");
  });

  it("preserves arbitrary shadow colors when changing shadow size", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TailwindMappedControls value="shadow-lg shadow-[#50d71e] border-white/10" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Appearance" }));
    moveSlider("Shadow", 4);

    expect(onChange).toHaveBeenCalledWith("shadow-md shadow-[#50d71e] border-white/10");
  });

  it.each(["shadow-(--my-shadow)", "shadow-[none]", "shadow-[inherit]"])(
    "replaces custom shadow size %s without leaving a conflicting utility",
    async (customShadow) => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<TailwindMappedControls value={`${customShadow} shadow-[#50d71e]`} onChange={onChange} />);

      await user.click(screen.getByRole("button", { name: "Appearance" }));
      moveSlider("Shadow", 4);

      expect(onChange).toHaveBeenCalledWith("shadow-md shadow-[#50d71e]");
    },
  );
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
}
