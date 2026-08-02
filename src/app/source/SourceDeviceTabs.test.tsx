import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import type { SourceTreeNode } from "./source-workspace-tree";
import { SourceDeviceTabs } from "./SourceDeviceTabs";

afterEach(cleanup);

const node: SourceTreeNode = {
  id: "components:ProjectSummary:ProjectSummary",
  area: "components",
  label: "ProjectSummary",
  entries: [],
  uses: [],
  implementations: {
    desktop: { requestedDevice: "desktop", sourceDevice: "desktop", state: "direct" },
    tablet: { requestedDevice: "tablet", sourceDevice: "desktop", state: "fallback" },
    mobile: { requestedDevice: "mobile", state: "missing" },
  },
};

it("uses a compact canvas switcher and allows selecting missing implementations", async () => {
  const onChange = vi.fn();
  render(<SourceDeviceTabs device="desktop" node={node} onChange={onChange} />);

  expect(screen.getByRole("group", { name: "Source implementation" })).toHaveClass("h-7");
  expect(screen.getByRole("button", { name: "Desktop implementation" }))
    .toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("button", { name: "Desktop implementation" }))
    .toHaveClass("items-center", "justify-center", "p-0");
  expect(screen.queryByText("Desktop")).not.toBeInTheDocument();
  expect(screen.queryByText("Tablet")).not.toBeInTheDocument();
  expect(screen.queryByText("Mobile")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Tablet implementation, Uses Desktop" })).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Mobile implementation, Missing" }));
  expect(onChange).toHaveBeenCalledWith("mobile");
});
