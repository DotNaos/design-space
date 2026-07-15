import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { replaceTailwindUtilityGroup, TailwindMappedControls } from "./TailwindMappedControls";

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

function moveSlider(name: string, index: number) {
  const slider = screen.getByRole("slider", { name });
  fireEvent.change(slider, { target: { value: String(index) } });
}
