import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import type { SourceWorkspaceTarget } from "../../shared/source-workspace";
import { SourceTargetPicker } from "./SourceTargetPicker";

afterEach(cleanup);

const targets: SourceWorkspaceTarget[] = [
  {
    id: "web",
    runtime: "react",
    sourceRoot: "clients/web",
    entrypoint: "clients/web/src/main.tsx",
    devices: [],
  },
  {
    id: "native",
    runtime: "react-native",
    sourceRoot: "clients/mobile",
    entrypoint: "clients/mobile/index.ts",
    devices: [],
  },
];

it("selects the target before device-specific controls", async () => {
  const onChange = vi.fn();
  render(<SourceTargetPicker targetId="web" targets={targets} onChange={onChange} />);

  await userEvent.click(screen.getByRole("button", { name: /App target/ }));
  await userEvent.click(screen.getByRole("option", { name: /Native/ }));
  expect(onChange).toHaveBeenCalledWith("native");
});

it("stays out of the way for a single target", () => {
  render(<SourceTargetPicker targetId="web" targets={[targets[0]!]} onChange={vi.fn()} />);
  expect(screen.queryByRole("button", { name: /App target/ })).not.toBeInTheDocument();
});
