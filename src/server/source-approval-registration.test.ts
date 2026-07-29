import { afterEach, describe, expect, it } from "vitest";

import type { SourceWorkspaceEntry } from "../shared/source-workspace";
import {
  sourceComponentApprovalScope,
  verifySourceComponentApprovals,
} from "./source-approval-registration";

const originalTrustRoot = process.env.PROJECT_APPROVAL_TRUST_ROOT;

const entry: SourceWorkspaceEntry = {
  id: "entry-button",
  label: "Button",
  area: "components",
  device: "desktop",
  fileId: "file-button",
  relativePath: "src/app/components/Button.tsx",
  exportName: "Button",
  props: [],
  slots: [],
  findings: [],
  source: { start: 0, end: 100 },
};

afterEach(() => {
  if (originalTrustRoot === undefined) {
    delete process.env.PROJECT_APPROVAL_TRUST_ROOT;
  } else {
    process.env.PROJECT_APPROVAL_TRUST_ROOT = originalTrustRoot;
  }
});

describe("source component approval registration", () => {
  it("uses a stable source-owned scope id", () => {
    expect(sourceComponentApprovalScope(entry)).toBe(
      "component:src/app/components/Button.tsx#Button",
    );
  });

  it("fails closed when approvals are not configured", async () => {
    expect(await verifySourceComponentApprovals(
      "/project",
      { project: { id: "project", label: "Project" } },
      [entry],
    )).toMatchObject({
      status: "not-configured",
      components: {},
    });
  });

  it("fails closed when the external trust root is unavailable", async () => {
    delete process.env.PROJECT_APPROVAL_TRUST_ROOT;
    expect(await verifySourceComponentApprovals(
      "/project",
      {
        project: { id: "project", label: "Project" },
        approvals: { policy: ".project/approvals/ui.yaml" },
      },
      [entry],
    )).toMatchObject({
      status: "unavailable",
      components: {},
      reason: expect.stringContaining("PROJECT_APPROVAL_TRUST_ROOT"),
    });
  });

  it("maps verified Project CLI evidence to source entries", async () => {
    process.env.PROJECT_APPROVAL_TRUST_ROOT = "/trusted/approvers.json";
    const result = await verifySourceComponentApprovals(
      "/project",
      {
        project: { id: "project", label: "Project" },
        approvals: { policy: ".project/approvals/ui.yaml" },
      },
      [entry],
      async (input) => {
        expect(input).toEqual({
          root: "/project",
          policy: ".project/approvals/ui.yaml",
          trustRoot: "/trusted/approvers.json",
        });
        return {
          repository: "/project",
          policyId: "ui-components",
          ok: true,
          scopes: [
            {
              id: sourceComponentApprovalScope(entry),
              label: "Button",
              state: "approved",
              attestation: "SHA256:verified",
            },
            {
              id: "component:src/ignored.tsx#Ignored",
              label: "Ignored",
              state: "stale",
              attestation: "SHA256:stale",
            },
          ],
        };
      },
    );

    expect(result).toEqual({
      status: "verified",
      policyId: "ui-components",
      components: {
        [entry.id]: {
          scopeId: sourceComponentApprovalScope(entry),
          label: "Button",
          state: "approved",
          attestation: "SHA256:verified",
        },
      },
    });
  });
});
