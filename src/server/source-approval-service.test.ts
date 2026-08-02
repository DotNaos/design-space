import { expect, it, vi } from "vitest";

import type { SourceWorkspaceEntry } from "../shared/source-workspace";
import { SourceApprovalService } from "./source-approval-service";
import type { RegisteredTarget } from "./target-registration";

const entry: SourceWorkspaceEntry = {
  id: "entry.button",
  label: "Button",
  area: "components",
  device: "desktop",
  fileId: "file.button",
  relativePath: "src/app/components/Button.tsx",
  exportName: "Button",
  props: [],
  slots: [],
  findings: [],
  source: { start: 0, end: 40 },
};

function target(): RegisteredTarget {
  return {
    project: { id: "review-app", label: "Review app" },
    root: "/trusted/review-app",
    targetModulePath: "/trusted/review-app/.designspace.ts",
    files: new Map(),
    editTargets: new Map(),
    sourceApproval: { policy: ".project/approvals/policy.yaml" },
    sourceWorkspace: {
      root: "/trusted/review-app",
      manifest: {
        runtime: "react",
        sourceRoot: "src",
        entries: [entry],
        devices: [],
      },
      files: [],
      entryFiles: new Map(),
      stylePaths: [],
    },
  };
}

it("signs exactly the server-registered component scope and verifies it", async () => {
  const sign = vi.fn(async () => undefined);
  const status = vi.fn(async () => ({
    repository: "/trusted/review-app",
    policyId: "component-review",
    ok: true,
    scopes: [{
      id: "component:src/app/components/Button.tsx#Button",
      label: "Button",
      state: "approved",
      attestation: "signed:button",
    }],
  }));
  const service = new SourceApprovalService(target(), {
    sign,
    status,
    trustRoot: "/outside/trust.json",
  });

  await expect(service.execute({ type: "sign-source-component", entryId: entry.id })).resolves.toMatchObject({
    state: "source-component-signed",
    entryId: entry.id,
    approvals: {
      status: "verified",
      components: { [entry.id]: { state: "approved" } },
    },
  });
  expect(sign).toHaveBeenCalledWith({
    policy: ".project/approvals/policy.yaml",
    root: "/trusted/review-app",
    scope: "component:src/app/components/Button.tsx#Button",
    trustRoot: "/outside/trust.json",
  });
});

it("rejects browser-selected or unknown component identities", async () => {
  const sign = vi.fn(async () => undefined);
  const service = new SourceApprovalService(target(), {
    sign,
    status: vi.fn(),
    trustRoot: "/outside/trust.json",
  });

  await expect(service.execute({
    type: "sign-source-component",
    entryId: "entry.unknown",
  })).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(service.execute({
    type: "sign-source-component",
    entryId: entry.id,
    scope: "component:/etc/passwd#Root",
  })).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  expect(sign).not.toHaveBeenCalled();
});

it("fails closed when the authenticated trust root is unavailable", async () => {
  const service = new SourceApprovalService(target(), {
    sign: vi.fn(),
    status: vi.fn(),
    trustRoot: "",
  });

  await expect(service.execute({ type: "sign-source-component", entryId: entry.id })).rejects.toMatchObject({
    code: "ACCESS_DENIED",
  });
});
