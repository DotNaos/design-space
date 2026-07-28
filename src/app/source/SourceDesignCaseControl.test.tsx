import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import type { RuntimeSourceWorkspaceEntry } from "../../shared/source-workspace";
import { SourceDesignCaseControl } from "./SourceDesignCaseControl";

afterEach(cleanup);

it("shows typed component states in Properties and changes the shared selection", async () => {
  const onCaseChange = vi.fn();
  const { container } = render(
    <SourceDesignCaseControl
      entry={statefulEntry()}
      selectedCase="loading"
      onCaseChange={onCaseChange}
    />,
  );

  await waitFor(() => {
    expect(
      container.querySelector<HTMLButtonElement>('button[aria-label="Component state"]'),
    ).not.toBeNull();
  });
  const select = container.querySelector<HTMLButtonElement>('button[aria-label="Component state"]');
  expect(select).not.toBeNull();
  expect(select).toHaveTextContent("loading");
  await userEvent.click(select!);
  await userEvent.click(await screen.findByRole("option", { name: "ready" }));
  expect(onCaseChange).toHaveBeenCalledWith("ready");
});

function statefulEntry(): RuntimeSourceWorkspaceEntry {
  return {
    id: "status",
    label: "Status",
    area: "components",
    device: "desktop",
    fileId: "status-file",
    relativePath: "src/Status.tsx",
    exportName: "Status",
    props: [],
    slots: [],
    findings: [],
    source: { start: 0, end: 10 },
    component: () => null,
    design: {
      fileId: "status-design",
      relativePath: "src/Status.design.tsx",
      load: async () => ({
        component: () => null,
        defaults: {},
        initialCase: "loading",
        isStateful: true,
        cases: { loading: {}, ready: {} },
        render: () => null,
      }),
    },
  };
}
