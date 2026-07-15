import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";

import { DocumentInspectorTabs } from "./DocumentInspectorTabs";

afterEach(cleanup);

it("keeps design controls first and exposes the full live document source from the top tabs", async () => {
  render(
    <DocumentInspectorTabs
      design={<div>Tailwind controls</div>}
      source={'{\n  "root": {\n    "adapterId": "demo.card"\n  }\n}'}
      sourceLabel="dashboard.design.json"
    />,
  );

  expect(screen.getByRole("tab", { name: "Design" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByText("Tailwind controls")).toBeVisible();

  await userEvent.click(screen.getByRole("tab", { name: "Code" }));

  expect(screen.getByRole("tab", { name: "Code" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("heading", { name: "dashboard.design.json" })).toBeVisible();
  expect(screen.getByRole("region", { name: "Current document source" })).toHaveTextContent('"adapterId"');
  expect(screen.getByRole("region", { name: "Current document source" })).toHaveTextContent('"demo.card"');
});
