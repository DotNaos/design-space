import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DesignDocument } from "../../shared/design-document";
import type {
  DocumentCatalog,
  DocumentOperation,
  DocumentSnapshot,
  PreparedDocumentCreate,
  PreparedDocumentSave,
  SavedDocument,
} from "../../shared/document-transactions";
import type { TargetModule } from "../../shared/target-module";
import { LocalOperationError, runLocalOperation } from "../api";
import { useDocumentWorkspace } from "./use-document-workspace";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return { ...actual, runLocalOperation: vi.fn() };
});

const runLocalOperationMock = vi.mocked(runLocalOperation);

beforeEach(() => {
  runLocalOperationMock.mockReset();
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useDocumentWorkspace managed creation", () => {
  it("uses the server-owned catalog as the source of truth for registered and managed documents", async () => {
    const catalog = documentCatalog([homeDocument, managedComponent]);
    installOperationHandler(catalog, [snapshot(homeDocument, "1"), snapshot(managedComponent, "2")]);

    const { result } = renderHook(() => useDocumentWorkspace(target));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.connected).toBe(true);
    expect(result.current.entries).toEqual(catalog.documents);
    expect(result.current.creationRecipes).toEqual(catalog.recipes);
    expect(result.current.files).toEqual(catalog.files);
    expect(result.current.documents.map((document) => document.id)).toEqual(["screen.home", "component.managed"]);
    expect(result.current.activeDocumentId).toBe("screen.home");
    expect(runLocalOperationMock).toHaveBeenCalledWith({ type: "list-documents" });
    expect(runLocalOperationMock).toHaveBeenCalledWith({ type: "read-document", documentId: "component.managed" });
  });

  it("discards a delayed prepare result after the document changes again", async () => {
    const catalog = documentCatalog([homeDocument]);
    let resolvePrepare!: (value: PreparedDocumentSave) => void;
    const delayedPrepare = new Promise<PreparedDocumentSave>((resolve) => { resolvePrepare = resolve; });
    runLocalOperationMock.mockImplementation(async (operation) => {
      const request = operation as DocumentOperation;
      if (request.type === "list-documents") return catalog as never;
      if (request.type === "read-document") return snapshot(homeDocument, "1") as never;
      if (request.type === "prepare-document-save") return delayedPrepare as never;
      throw new Error(`Unexpected operation ${request.type}`);
    });

    const { result } = renderHook(() => useDocumentWorkspace(target));
    await waitFor(() => expect(result.current.connected).toBe(true));
    act(() => result.current.edit({ ...homeDocument, label: "First" }));

    let response: PreparedDocumentSave | undefined;
    let request!: Promise<void>;
    act(() => {
      request = result.current.prepare().then((value) => { response = value; });
    });
    await waitFor(() => expect(result.current.session?.phase).toBe("checking"));
    act(() => result.current.edit({ ...homeDocument, label: "Second" }));
    resolvePrepare(preparedSave({ ...homeDocument, label: "First" }));
    await act(async () => request);

    expect(response).toBeUndefined();
    expect(result.current.session?.draft.label).toBe("Second");
    expect(result.current.session?.phase).toBe("editing");
    expect(result.current.session?.prepared).toBeUndefined();
  });

  it("prepares creation with only the registered recipe id and human label", async () => {
    const catalog = documentCatalog([homeDocument]);
    const prepared = preparedCreate(createdScreen);
    installOperationHandler(catalog, [snapshot(homeDocument, "1")], { prepared });

    const { result } = renderHook(() => useDocumentWorkspace(target));
    await waitFor(() => expect(result.current.connected).toBe(true));

    let response: PreparedDocumentCreate | undefined;
    await act(async () => {
      response = await result.current.prepareCreate("recipe.screen.blank", "Settings");
    });

    expect(response).toEqual(prepared);
    expect(runLocalOperationMock).toHaveBeenLastCalledWith({
      type: "prepare-document-create",
      recipeId: "recipe.screen.blank",
      label: "Settings",
    });
    expect(runLocalOperationMock.mock.calls.at(-1)?.[0]).not.toHaveProperty("path");
    expect(runLocalOperationMock.mock.calls.at(-1)?.[0]).not.toHaveProperty("documentId");
    expect(result.current.message).toBeUndefined();
  });

  it("refreshes the dynamic catalog and selects the server-created document after save", async () => {
    let created = false;
    runLocalOperationMock.mockImplementation(async (operation) => {
      const request = operation as DocumentOperation;
      if (request.type === "list-documents") {
        return documentCatalog(created ? [homeDocument, createdScreen] : [homeDocument]) as never;
      }
      if (request.type === "read-document") {
        const document = request.documentId === createdScreen.id ? createdScreen : homeDocument;
        return snapshot(document, document === createdScreen ? "3" : "1") as never;
      }
      if (request.type === "save-document") {
        created = true;
        return saved(createdScreen.id) as never;
      }
      throw new Error(`Unexpected operation ${request.type}`);
    });

    const { result } = renderHook(() => useDocumentWorkspace(target));
    await waitFor(() => expect(result.current.connected).toBe(true));

    let response: SavedDocument | undefined;
    await act(async () => {
      response = await result.current.saveCreate("00000000-0000-4000-8000-000000000001", createdScreen.id);
    });

    expect(response?.documentId).toBe(createdScreen.id);
    expect(result.current.entries.map((entry) => entry.id)).toEqual([homeDocument.id, createdScreen.id]);
    expect(result.current.documents.map((document) => document.id)).toEqual([homeDocument.id, createdScreen.id]);
    expect(result.current.files).toContainEqual({
      id: `file.${createdScreen.id}`,
      label: `${createdScreen.id}.design.json`,
      kind: "file",
    });
    expect(result.current.activeDocumentId).toBe(createdScreen.id);
    expect(runLocalOperationMock).toHaveBeenCalledWith({
      type: "save-document",
      challengeId: "00000000-0000-4000-8000-000000000001",
    });
  });

  it("keeps creation disabled while disconnected and exposes a rejected prepare without losing the loaded catalog", async () => {
    runLocalOperationMock.mockRejectedValueOnce(new LocalOperationError("LOCAL_RUNTIME_ERROR", "The local runtime is offline."));
    const disconnected = renderHook(() => useDocumentWorkspace(target));
    await waitFor(() => expect(disconnected.result.current.loading).toBe(false));

    expect(disconnected.result.current.connected).toBe(false);
    expect(disconnected.result.current.message).toBe("The local runtime is offline.");
    const callsBeforePrepare = runLocalOperationMock.mock.calls.length;
    let disconnectedPrepare: PreparedDocumentCreate | undefined;
    await act(async () => {
      disconnectedPrepare = await disconnected.result.current.prepareCreate("recipe.screen.blank", "Settings");
    });
    expect(disconnectedPrepare).toBeUndefined();
    expect(runLocalOperationMock).toHaveBeenCalledTimes(callsBeforePrepare);
    disconnected.unmount();

    runLocalOperationMock.mockReset();
    const catalog = documentCatalog([homeDocument]);
    installOperationHandler(catalog, [snapshot(homeDocument, "1")], {
      prepareError: new LocalOperationError("INVALID_INPUT", "That creation recipe is not registered."),
    });
    const connected = renderHook(() => useDocumentWorkspace(target));
    await waitFor(() => expect(connected.result.current.connected).toBe(true));

    let rejected: PreparedDocumentCreate | undefined;
    await act(async () => {
      rejected = await connected.result.current.prepareCreate("recipe.screen.missing", "Settings");
    });
    expect(rejected).toBeUndefined();
    expect(connected.result.current.message).toBe("That creation recipe is not registered.");
    expect(connected.result.current.entries).toEqual(catalog.documents);
  });
});

const homeDocument: DesignDocument = {
  schemaVersion: 2,
  id: "screen.home",
  label: "Home",
  kind: "screen",
  root: { instanceId: "home.root", adapterId: "stack", slots: { content: [] } },
};

const managedComponent: DesignDocument = {
  schemaVersion: 2,
  id: "component.managed",
  label: "Managed panel",
  kind: "component",
  component: {
    id: "managed-panel",
    label: "Managed panel",
    group: "Surfaces",
    recipeId: "recipe.component.panel",
    properties: [],
    slots: [{ id: "body", label: "Body", min: 0 }],
  },
  root: {
    instanceId: "panel.root",
    adapterId: "stack",
    slots: { content: [{ kind: "slot-outlet", id: "panel.body", slotId: "body" }] },
  },
};

const createdScreen: DesignDocument = {
  schemaVersion: 2,
  id: "screen.created",
  label: "Settings",
  kind: "screen",
  root: { instanceId: "created.root", adapterId: "stack", slots: { content: [] } },
};

const target: TargetModule = {
  project: { id: "creation-test", label: "Creation test" },
  defaultAdapterId: "stack",
  defaultDocumentId: homeDocument.id,
  documents: [{ id: homeDocument.id, label: homeDocument.label, kind: homeDocument.kind }],
  componentRecipes: [{ id: "recipe.component.panel", label: "Panel", rootAdapterId: "stack", rootSlotId: "content" }],
  defaultFixture: { instanceId: "legacy.root", adapterId: "stack", slots: { content: [] } },
  files: [],
  adapters: [{
    component: { id: "stack", label: "Stack", group: "Layout", slots: [{ id: "content", label: "Content" }] },
    render: (_props, context) => <main>{context.slotChildren.content}</main>,
  }],
};

function documentCatalog(documents: readonly DesignDocument[]): DocumentCatalog {
  return {
    state: "catalog",
    documents: documents.map((document) => ({
      id: document.id,
      label: document.label,
      kind: document.kind,
      origin: document.id.includes("managed") || document.id.includes("created") ? "managed" : "registered",
    })),
    recipes: [
      { id: "recipe.screen.blank", label: "Blank screen", kind: "screen" },
      { id: "recipe.component.panel", label: "Panel", kind: "component" },
    ],
    files: [
      { id: "document.home", label: "home.design.json", kind: "file" },
      ...documents.filter((document) => document.id !== homeDocument.id).map((document) => ({
        id: `file.${document.id}`,
        label: `${document.id}.design.json`,
        kind: "file" as const,
      })),
    ],
  };
}

function snapshot(document: DesignDocument, marker: string): DocumentSnapshot {
  return {
    documentId: document.id,
    document,
    documentDigest: marker.repeat(64),
    sourceVersions: { [`source.${document.id}`]: marker.repeat(64) },
  };
}

function preparedCreate(document: DesignDocument): PreparedDocumentCreate {
  const digest = "4".repeat(64);
  return {
    state: "create-ready",
    challengeId: "00000000-0000-4000-8000-000000000001",
    documentId: document.id,
    createdDocument: document,
    documentDigest: digest,
    nextSourceVersions: { "managed.document": digest },
    changes: [{ fileId: "managed.document", label: "Managed document", beforeVersion: null, nextVersion: digest }],
    diff: "+ managed document",
    strictUi: {
      id: "00000000-0000-4000-8000-000000000002",
      projectId: target.project.id,
      documentId: document.id,
      basis: { documentDigest: digest, sourceVersion: digest, ruleSetVersion: "strict-ui-v1" },
      status: "passed",
      checkedAt: "2026-07-14T00:00:00.000Z",
      violations: [],
    },
    compile: { status: "passed", checkedAt: "2026-07-14T00:00:00.000Z" },
    transactionDigest: "5".repeat(64),
    expiresAt: "2026-07-14T00:05:00.000Z",
  };
}

function preparedSave(document: DesignDocument): PreparedDocumentSave {
  const digest = "8".repeat(64);
  return {
    state: "ready",
    challengeId: "00000000-0000-4000-8000-000000000008",
    documentId: document.id,
    documentDigest: digest,
    baseSourceVersions: { [`source.${document.id}`]: "1".repeat(64) },
    nextSourceVersions: { [`source.${document.id}`]: digest },
    changes: [{ fileId: `source.${document.id}`, label: document.label, beforeVersion: "1".repeat(64), nextVersion: digest }],
    diff: `+ ${document.label}`,
    strictUi: {
      id: "00000000-0000-4000-8000-000000000009",
      projectId: target.project.id,
      documentId: document.id,
      basis: { documentDigest: digest, sourceVersion: "1".repeat(64), ruleSetVersion: "strict-ui-v1" },
      status: "passed",
      checkedAt: "2026-07-14T00:00:00.000Z",
      violations: [],
    },
    compile: { status: "passed", checkedAt: "2026-07-14T00:00:00.000Z" },
    transactionDigest: "9".repeat(64),
    expiresAt: "2026-07-14T00:05:00.000Z",
  };
}

function saved(documentId: string): SavedDocument {
  return {
    state: "saved",
    documentId,
    documentDigest: "6".repeat(64),
    previousDocumentDigest: null,
    sourceVersions: { "managed.document": "6".repeat(64) },
    transactionDigest: "7".repeat(64),
  };
}

function installOperationHandler(
  catalog: DocumentCatalog,
  snapshots: readonly DocumentSnapshot[],
  options: { prepared?: PreparedDocumentCreate; prepareError?: Error } = {},
) {
  runLocalOperationMock.mockImplementation(async (operation) => {
    const request = operation as DocumentOperation;
    if (request.type === "list-documents") return catalog as never;
    if (request.type === "read-document") {
      const value = snapshots.find((entry) => entry.documentId === request.documentId);
      if (!value) throw new Error(`Missing snapshot ${request.documentId}`);
      return value as never;
    }
    if (request.type === "prepare-document-create") {
      if (options.prepareError) throw options.prepareError;
      if (!options.prepared) throw new Error("No prepared create configured");
      return options.prepared as never;
    }
    throw new Error(`Unexpected operation ${request.type}`);
  });
}
