import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it } from "vitest";

import { DesignSpaceThemeToggle } from "./DesignSpaceThemeToggle";

beforeEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.designSpaceTheme;
  document.documentElement.style.colorScheme = "";
});

afterEach(cleanup);

it("switches and persists the Design Space theme", async () => {
  render(<DesignSpaceThemeToggle />);

  await userEvent.click(screen.getByRole("button", { name: "Switch Design Space to light theme" }));
  expect(document.documentElement).toHaveAttribute("data-design-space-theme", "light");
  expect(document.documentElement.style.colorScheme).toBe("light");
  expect(window.localStorage.getItem("design-space.theme")).toBe("light");

  await userEvent.click(screen.getByRole("button", { name: "Switch Design Space to dark theme" }));
  expect(document.documentElement).toHaveAttribute("data-design-space-theme", "dark");
  expect(window.localStorage.getItem("design-space.theme")).toBe("dark");
});
