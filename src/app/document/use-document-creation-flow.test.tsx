import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DesignDocument } from "../../shared/design-document";
import type { PreparedDocumentCreate, ReadyDocumentCreate, SavedDocument } from "../../shared/document-transactions";
import type { StrictUiEvidence } from "../../shared/strict-ui";
import { useDocumentCreationFlow } from "./use-document-creation-flow";

describe("document creation flow", () => {
  it("moves from the creator to an exact diff and reports the saved document", async () => {
    const onCreated = vi.fn();
    const saveCreate = vi.fn().mockResolvedValue(savedDocument);
    const { result } = renderHook(() => useDocumentCreationFlow({
      prepareCreate: vi.fn().mockResolvedValue(readyCreation),
      saveCreate,
      onCreated,
    }));

    act(() => result.current.open());
    await act(() => result.current.prepare("recipe.screen", "Settings"));

    expect(result.current.isOpen).toBe(false);
    expect(result.current.prepared).toBe(readyCreation);

    await act(() => result.current.save());

    expect(saveCreate).toHaveBeenCalledWith(readyCreation.challengeId, readyCreation.documentId);
    expect(result.current.prepared).toBeUndefined();
    expect(onCreated).toHaveBeenCalledWith(createdScreen);
  });

  it.each([
    [undefined, "The local target could not prepare this document."],
    [strictBlocked, "Use a registered component."],
    [compileBlocked, "Target build failed."],
  ] as const)("keeps the creator open when source review is blocked", async (response, message) => {
    const { result } = renderHook(() => useDocumentCreationFlow({
      prepareCreate: vi.fn().mockResolvedValue(response),
      saveCreate: vi.fn(),
      onCreated: vi.fn(),
    }));

    act(() => result.current.open());
    await act(() => result.current.prepare("recipe.screen", "Settings"));

    expect(result.current.isOpen).toBe(true);
    expect(result.current.error).toBe(message);
    expect(result.current.prepared).toBeUndefined();
  });

  it("discards a failed save and requires a fresh source diff", async () => {
    const { result } = renderHook(() => useDocumentCreationFlow({
      prepareCreate: vi.fn().mockResolvedValue(readyCreation),
      saveCreate: vi.fn().mockResolvedValue(undefined),
      onCreated: vi.fn(),
    }));

    await act(() => result.current.prepare("recipe.screen", "Settings"));
    await act(() => result.current.save());

    expect(result.current.prepared).toBeUndefined();
    expect(result.current.isOpen).toBe(true);
    expect(result.current.error).toContain("Prepare a fresh source diff");
  });
});

const createdScreen: DesignDocument = {
  schemaVersion: 2,
  id: "screen.settings",
  label: "Settings",
  kind: "screen",
  root: { instanceId: "settings.root", adapterId: "stack", slots: { content: [] } },
};

const strictUi: StrictUiEvidence = {
  id: "strict.settings",
  projectId: "demo",
  documentId: createdScreen.id,
  basis: { documentDigest: digest("a"), sourceVersion: digest("a"), ruleSetVersion: "strict.v1" },
  status: "blocked",
  checkedAt: "2026-07-14T00:00:00.000Z",
  violations: [{
    ruleId: "registered-only",
    severity: "error" as const,
    message: "Use a registered component.",
    location: { kind: "document" as const },
  }],
};

const readyCreation: ReadyDocumentCreate = {
  state: "create-ready",
  challengeId: "11111111-1111-4111-8111-111111111111",
  documentId: createdScreen.id,
  createdDocument: createdScreen,
  documentDigest: digest("b"),
  nextSourceVersions: { "settings.source": digest("b") },
  changes: [{ fileId: "settings.source", label: "settings.design.json", beforeVersion: null, nextVersion: digest("b") }],
  diff: "+ Settings",
  strictUi: { ...strictUi, status: "passed", violations: [] },
  compile: { status: "passed", checkedAt: "2026-07-14T00:00:00.000Z" },
  transactionDigest: digest("c"),
  expiresAt: "2026-07-14T00:05:00.000Z",
};

const strictBlocked: PreparedDocumentCreate = {
  state: "strict-blocked",
  documentId: createdScreen.id,
  documentDigest: digest("a"),
  strictUi,
};

const compileBlocked: PreparedDocumentCreate = {
  state: "compile-blocked",
  documentId: createdScreen.id,
  documentDigest: digest("a"),
  strictUi: { ...strictUi, status: "passed", violations: [] },
  compile: { status: "failed", checkedAt: "2026-07-14T00:00:00.000Z", message: "Target build failed." },
};

const savedDocument: SavedDocument = {
  state: "saved",
  documentId: createdScreen.id,
  documentDigest: digest("b"),
  previousDocumentDigest: null,
  sourceVersions: { "settings.source": digest("b") },
  transactionDigest: digest("c"),
};

function digest(character: string): string {
  return character.repeat(64);
}
