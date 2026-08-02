import { expect, it, vi } from "vitest";

import { createSourceDraftWorkspace, sourceDraftDigest } from "./source-draft-workspace";
import type { SourceDraftBase, SourceDraftLocation } from "./source-draft-workspace-types";
import { prepareSelectedDraftGroups } from "./useSourceChangeReview";

const contract: SourceDraftLocation = { scope: "app", rootId: "/project", fileId: "contract.tsx" };
const consumer: SourceDraftLocation = { scope: "app", rootId: "/project", fileId: "consumer.tsx" };

it("validates a coordinated contract and consumer as one group before either can be approved", async () => {
  const prepare = vi.fn(async () => ({ state: "invalid" as const, message: "single-file validation must not run" }));
  const prepareGroup = vi.fn(async () => ({ state: "valid" as const, prepared: { challengeId: "prepared-together" } }));
  const workspace = createSourceDraftWorkspace({
    sourceAdapter: { read: async (location) => base(location), prepare, prepareGroup },
  });
  await workspace.hydrate();
  workspace.open(base(contract));
  workspace.open(base(consumer));
  workspace.edit(contract, "export type Contract = string");
  workspace.edit(consumer, "export const consumer: Contract = 'ready'");

  await expect(workspace.prepareGroup([contract, consumer])).resolves.toMatchObject({ state: "valid" });

  expect(prepare).not.toHaveBeenCalled();
  expect(prepareGroup).toHaveBeenCalledWith([
    expect.objectContaining({ ...contract, draftDigest: sourceDraftDigest("export type Contract = string") }),
    expect.objectContaining({ ...consumer, draftDigest: sourceDraftDigest("export const consumer: Contract = 'ready'") }),
  ]);
  expect(workspace.get(contract)?.validation.state).toBe("valid");
  expect(workspace.get(consumer)?.validation.state).toBe("valid");
  workspace.approve(contract);
  workspace.approve(consumer);
  expect(workspace.getSnapshot().canApply).toBe(true);
});

it("invalidates the complete prepared group when one coordinated draft changes", async () => {
  const workspace = createSourceDraftWorkspace({
    sourceAdapter: {
      read: async (location) => base(location),
      prepare: async () => ({ state: "valid", prepared: undefined }),
      prepareGroup: async () => ({ state: "valid", prepared: undefined }),
    },
  });
  await workspace.hydrate();
  for (const location of [contract, consumer]) {
    workspace.open(base(location));
    workspace.edit(location, `draft ${location.fileId}`);
  }
  await workspace.prepareGroup([contract, consumer]);
  workspace.approve(contract);
  workspace.approve(consumer);

  workspace.edit(contract, "changed contract");

  expect(workspace.get(contract)?.validation.state).toBe("unvalidated");
  expect(workspace.get(consumer)).toMatchObject({
    approved: false,
    validation: { state: "unvalidated" },
  });
  expect(workspace.getSnapshot().canApply).toBe(false);
});

it("does not apply a late group result after any member changed", async () => {
  let resolve!: (result: { state: "valid"; prepared: undefined }) => void;
  const pending = new Promise<{ state: "valid"; prepared: undefined }>((done) => { resolve = done; });
  const workspace = createSourceDraftWorkspace({
    sourceAdapter: {
      read: async (location) => base(location),
      prepare: async () => pending,
      prepareGroup: async () => pending,
    },
  });
  await workspace.hydrate();
  for (const location of [contract, consumer]) {
    workspace.open(base(location));
    workspace.edit(location, `draft ${location.fileId}`);
  }
  const preparing = workspace.prepareGroup([contract, consumer]);
  workspace.edit(contract, "newer contract");
  resolve({ state: "valid", prepared: undefined });
  await preparing;

  expect(workspace.get(contract)?.validation.state).toBe("unvalidated");
  expect(workspace.get(consumer)?.validation.state).toBe("unvalidated");
});

it("lets review exclusion revalidate and approve only the selected valid subset", async () => {
  const preparedGroups: string[][] = [];
  const workspace = createSourceDraftWorkspace({
    sourceAdapter: {
      read: async (location) => base(location),
      prepare: async () => ({ state: "invalid", message: "Use batch validation" }),
      prepareGroup: async (requests) => {
        preparedGroups.push(requests.map((request) => request.fileId));
        return requests.some((request) => request.fileId === consumer.fileId)
          ? { state: "invalid", message: "Consumer is invalid" }
          : { state: "valid", prepared: undefined };
      },
    },
  });
  await workspace.hydrate();
  for (const location of [contract, consumer]) {
    workspace.open(base(location));
    workspace.edit(location, `draft ${location.fileId}`);
  }

  await prepareSelectedDraftGroups(workspace);
  expect(workspace.get(contract)?.validation.state).toBe("invalid");
  workspace.setSelectedForReview(consumer, false);
  await prepareSelectedDraftGroups(workspace, new Set([JSON.stringify(["app", "/project"])]));
  workspace.approve(contract);

  expect(preparedGroups).toEqual([
    ["contract.tsx", "consumer.tsx"],
    ["contract.tsx"],
  ]);
  expect(workspace.get(contract)?.validation.state).toBe("valid");
  expect(workspace.get(consumer)?.validation.state).toBe("invalid");
  expect(workspace.getSnapshot()).toMatchObject({ selectedChangeCount: 1, canApply: true });
});

function base(location: SourceDraftLocation): SourceDraftBase {
  return {
    ...location,
    label: location.fileId,
    path: `src/${location.fileId}`,
    baseSource: `base ${location.fileId}`,
    baseVersion: "0".repeat(64),
  };
}
