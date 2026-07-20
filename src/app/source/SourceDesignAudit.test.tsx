import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import type { RuntimeSourceWorkspace, RuntimeSourceWorkspaceEntry } from "../../shared/source-workspace";
import { SourceDesignAudit } from "./SourceDesignAudit";

afterEach(cleanup);

it("audits ready and missing component designs and opens their source", async () => {
  const onSelect = vi.fn();
  render(<SourceDesignAudit workspace={workspace} onSelect={onSelect} />);

  await userEvent.click(screen.getByRole("button", { name: "Open design file audit, 1 missing of 2" }));
  expect(within(screen.getByRole("region", { name: "Missing design files" })).getByText("MissingPanel")).toBeVisible();
  expect(within(screen.getByRole("region", { name: "Ready design files" })).getByText("ReadyPanel")).toBeVisible();

  await userEvent.type(screen.getByRole("searchbox", { name: "Search design file audit" }), "ready");
  expect(screen.queryByText("MissingPanel")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Open ReadyPanel source, design ready" }));
  expect(onSelect).toHaveBeenCalledWith(readyEntry);
  expect(screen.queryByRole("searchbox", { name: "Search design file audit" })).not.toBeInTheDocument();
});

const baseEntry: RuntimeSourceWorkspaceEntry = {
  id: "missing",
  label: "MissingPanel",
  area: "components",
  device: "desktop",
  fileId: "missing-source",
  relativePath: "src/app/components/MissingPanel/index.tsx",
  exportName: "MissingPanel",
  props: [],
  slots: [],
  findings: [],
  source: { start: 0, end: 1 },
  component: () => null,
};

const readyEntry: RuntimeSourceWorkspaceEntry = {
  ...baseEntry,
  id: "ready",
  label: "ReadyPanel",
  fileId: "ready-source",
  relativePath: "src/app/components/ReadyPanel/index.tsx",
  exportName: "ReadyPanel",
  design: { fileId: "ready-design", relativePath: "src/app/components/ReadyPanel/index.design.tsx", load: async () => ({}) as never },
};

const workspace: RuntimeSourceWorkspace = {
  runtime: "react",
  sourceRoot: "src/app",
  entries: [readyEntry, baseEntry],
  devices: [],
  styles: [],
};
