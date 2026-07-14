import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { replaceTailwindUtilityGroup, TailwindMappedControls } from "./TailwindMappedControls";

afterEach(cleanup);

it("replaces only the selected Tailwind utility group", () => {
  expect(replaceTailwindUtilityGroup("flex flex-row p-4 text-sm", ["flex-row", "flex-col"], "flex-col"))
    .toBe("flex p-4 text-sm flex-col");
});

it("emits Tailwind classes from visual inspector controls", () => {
  const onChange = vi.fn();
  render(<TailwindMappedControls value="flex p-4 px-8 sm:p-6 rounded-lg" onChange={onChange} />);

  fireEvent.change(screen.getByRole("combobox", { name: "Padding Tailwind utility" }), { target: { value: "p-6" } });

  expect(onChange).toHaveBeenCalledWith("flex rounded-lg p-6");
});
