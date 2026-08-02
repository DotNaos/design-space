import { afterEach, expect, it, vi } from "vitest";

import {
  createLocalSourceDraftWorkspace,
  preparedSourceDraftModuleUrl,
} from "./source-draft-local";
import type { SourceDraftBase, SourceDraftLocation } from "./source-draft-workspace-types";

const contract: SourceDraftLocation = { scope: "app", rootId: "/project", fileId: "contract.tsx" };
const consumer: SourceDraftLocation = { scope: "app", rootId: "/project", fileId: "consumer.tsx" };

afterEach(() => vi.unstubAllGlobals());

it("uses the server batch prepare for a coordinated local draft group without applying it", async () => {
  const fetch = vi.fn(async (_url: string, init?: RequestInit) => new Response(JSON.stringify({
    ok: true,
    data: {
      state: "source-change-set-ready",
      challengeId: "00000000-0000-4000-8000-000000000001",
      scope: "app",
      changes: [],
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    },
  }), { status: 200, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetch);
  const workspace = createLocalSourceDraftWorkspace();
  await workspace.hydrate();
  for (const location of [contract, consumer]) {
    workspace.open(base(location));
    workspace.edit(location, `draft ${location.fileId}`);
  }

  await workspace.prepareGroup([contract, consumer]);

  const operation = JSON.parse(String((fetch.mock.calls[0]?.[1] as RequestInit | undefined)?.body));
  expect(operation).toEqual({
    type: "prepare-source-change-set",
    scope: "app",
    changes: [
      { fileId: "contract.tsx", baseVersion: "0".repeat(64), source: "draft contract.tsx" },
      { fileId: "consumer.tsx", baseVersion: "0".repeat(64), source: "draft consumer.tsx" },
    ],
  });
  expect(fetch).toHaveBeenCalledOnce();
  expect(workspace.get(contract)?.validation.state).toBe("valid");
  expect(workspace.get(consumer)?.validation.state).toBe("valid");
  expect(preparedSourceDraftModuleUrl(
    workspace.get(contract)!,
    "contract.design.tsx",
    "src/contract.design.tsx",
    workspace.getSnapshot().changes,
  )).toContain("00000000-0000-4000-8000-000000000001/contract.design.tsx/module.tsx");

  workspace.setSelectedForReview(contract, false);
  expect(preparedSourceDraftModuleUrl(
    workspace.get(contract)!,
    "contract.design.tsx",
    "src/contract.design.tsx",
    workspace.getSnapshot().changes,
  )).toBeUndefined();
});

it("supersedes the prior server challenge whenever a prepared group pointer is replaced", async () => {
  let sequence = 0;
  const fetch = vi.fn(async (_url: string, _init?: RequestInit) => {
    const challengeId = `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`;
    return new Response(JSON.stringify({
      ok: true,
      data: {
        state: "source-change-set-ready",
        challengeId,
        scope: "app",
        changes: [],
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    }), { status: 200, headers: { "content-type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetch);
  const repeatedContract = { ...contract, rootId: "/repeated-project" };
  const repeatedConsumer = { ...consumer, rootId: "/repeated-project" };
  const workspace = createLocalSourceDraftWorkspace();
  await workspace.hydrate();
  for (const location of [repeatedContract, repeatedConsumer]) {
    workspace.open(base(location));
    workspace.edit(location, `draft ${location.fileId}`);
  }

  await workspace.prepareGroup([repeatedContract, repeatedConsumer]);
  await workspace.prepareGroup([repeatedContract, repeatedConsumer]);
  await workspace.prepareGroup([repeatedContract, repeatedConsumer]);

  const operations = fetch.mock.calls.map((call) => JSON.parse(String((call[1] as RequestInit | undefined)?.body)));
  expect(operations.map((operation) => operation.supersedesChallengeId)).toEqual([
    undefined,
    "00000000-0000-4000-8000-000000000001",
    "00000000-0000-4000-8000-000000000002",
  ]);
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
