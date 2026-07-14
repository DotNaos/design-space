import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import { replaceTailwindUtilityGroup, TailwindMappedControls } from "./TailwindMappedControls";

afterEach(cleanup);

it("replaces only the selected Tailwind utility group", () => {
  expect(replaceTailwindUtilityGroup("flex flex-row p-4 text-sm", ["flex-row", "flex-col"], "flex-col"))
    .toBe("flex p-4 text-sm flex-col");
});

it("emits Tailwind classes from visual inspector controls", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<TailwindMappedControls value="flex p-4 px-8 sm:p-6 rounded-lg" onChange={onChange} />);

  const trigger = screen.getByRole("button", { name: /Padding Tailwind utility/ });
  expect(trigger).toHaveTextContent("p-4");
  await user.click(trigger);
  await user.click(screen.getByRole("option", { name: "p-6" }));

  expect(onChange).toHaveBeenCalledWith("flex rounded-lg p-6");
});
