import { expect, it } from "vitest";

import type { SourceApprovalEvidence } from "../../shared/source-workspace";
import { sourceCanvasApprovalStatus } from "./SourceApprovalStatus";

const approvals: SourceApprovalEvidence = {
  components: {
    approved: {
      attestation: "SHA256:verified",
      label: "Approved component",
      scopeId: "component:approved",
      state: "approved",
    },
    invalid: {
      attestation: "SHA256:invalid",
      label: "Invalid component",
      scopeId: "component:invalid",
      state: "invalid",
    },
    stale: {
      attestation: "SHA256:stale",
      label: "Stale component",
      scopeId: "component:stale",
      state: "stale",
    },
  },
  policyId: "strict-ui",
  status: "verified",
};

it("maps verified canvas parents to approval review tones", () => {
  expect(sourceCanvasApprovalStatus(approvals, "approved")).toMatchObject({ tone: "approved" });
  expect(sourceCanvasApprovalStatus(approvals, "stale")).toMatchObject({ tone: "pending" });
  expect(sourceCanvasApprovalStatus(approvals, "missing")).toMatchObject({ tone: "pending" });
  expect(sourceCanvasApprovalStatus(approvals, "invalid")).toMatchObject({ tone: "invalid" });
});

it("fails closed when approval evidence is unavailable", () => {
  expect(sourceCanvasApprovalStatus({ components: {}, status: "unavailable" }, "component"))
    .toMatchObject({ tone: "invalid" });
  expect(sourceCanvasApprovalStatus(undefined, "component"))
    .toMatchObject({ tone: "pending" });
});
