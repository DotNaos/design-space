import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { slotSelectionId } from "../model";
import type { TailwindPreview } from "../shared/contracts";
import type { DesignDocument } from "../shared/design-document";
import type {
  DocumentCatalog,
  DocumentSnapshot,
  PreparedDocumentCreate,
  PreparedDocumentSave,
  SavedDocument,
} from "../shared/document-transactions";
import type { TargetModule } from "../shared/target-module";
import { LocalOperationError, runLocalOperation } from "./api";
import { DocumentWorkspace } from "./DocumentWorkspace";

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return { ...actual, runLocalOperation: vi.fn() };
});

const runLocalOperationMock = vi.mocked(runLocalOperation);
const originalMatchMedia = window.matchMedia;

beforeEach(() => {
  runLocalOperationMock.mockReset();
  window.localStorage.clear();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: query.includes("max-width"),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Object.defineProperty(window, "matchMedia", { configurable: true, value: originalMatchMedia });
});

it("builds an empty authored slot on mobile, edits the item, saves, and reloads it", async () => {
  let persistedScreen = screenDocument;
  let preparedDocument: DesignDocument | undefined;
  installServer(() => persistedScreen, (document) => { preparedDocument = document; }, () => {
    if (!preparedDocument) throw new Error("No prepared document");
    persistedScreen = preparedDocument;
  });

  const first = render(<DocumentWorkspace target={target} />);
  expect((await screen.findAllByText("Mobile home")).length).toBeGreaterThan(0);
  await waitFor(() => expect(runLocalOperationMock).toHaveBeenCalledWith({
    type: "compile-tailwind",
    value: "p-4",
  }));

  const publicSlotId = slotSelectionId("panel.instance", "body");
  const publicOutlet = first.container.querySelector<HTMLElement>(
    `[data-design-space-slot-id="${publicSlotId}"]`,
  );
  expect(publicOutlet).toBeTruthy();
  fireEvent.click(publicOutlet!);

  expect(await screen.findByRole("dialog", { name: "Add to Body slot" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /^Text\b/ }));
  const editor = await screen.findByRole("dialog", { name: "Edit Text" });
  expect(editor).toHaveAttribute("open");

  const mobileEditor = within(editor);
  const content = mobileEditor.getByRole("textbox", { name: "Content" });
  await userEvent.clear(content);
  await userEvent.type(content, "Written from mobile");
  await waitFor(() => expect(mobileEditor.getByRole("button", { name: "Apply" })).toBeEnabled());
  await userEvent.click(mobileEditor.getByRole("button", { name: "Apply" }));
  expect(await screen.findByText("Written from mobile")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Prepare exact diff" }));
  expect(await screen.findByRole("dialog", { name: "Exact source diff" })).toBeInTheDocument();
  expect(screen.getByLabelText("Source diff, scroll in both directions")).toHaveTextContent("Written from mobile");
  await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(persistedScreen.root.slots.body).toHaveLength(1));

  first.unmount();
  render(<DocumentWorkspace target={target} />);
  expect(await screen.findByText("Written from mobile")).toBeInTheDocument();
}, 15_000);

it("opens a default component document in Library mode after loading", async () => {
  installServer(() => screenDocument, () => undefined, () => undefined);
  const componentTarget: TargetModule = { ...target, defaultDocumentId: panelDocument.id };

  render(<DocumentWorkspace target={componentTarget} />);

  await userEvent.click(await screen.findByRole("button", { name: "Open Project" }));
  expect(await screen.findByText("Components")).toBeVisible();
  const projectBrowser = screen.getByRole("region", { name: "Project browser" });
  expect(within(projectBrowser).getByRole("button", { name: "Panel" })).toHaveAttribute("aria-current", "page");
  expect(screen.queryByText("Screens")).not.toBeInTheDocument();
});

it("blocks an unsourced fallback after the initial read fails and recovers on focus", async () => {
  let failNextCatalogRead = true;
  runLocalOperationMock.mockImplementation(async (operation) => {
    if (operation.type === "list-documents") {
      if (failNextCatalogRead) {
        failNextCatalogRead = false;
        throw new LocalOperationError("LOCAL_RUNTIME_ERROR", "The local runtime is offline.");
      }
      return catalog as never;
    }
    if (operation.type === "read-document") {
      return snapshot(operation.documentId === screenDocument.id ? screenDocument : panelDocument) as never;
    }
    if (operation.type === "compile-tailwind") return { value: operation.value, css: "" } as never;
    throw new Error(`Unexpected operation ${operation.type}`);
  });

  render(<DocumentWorkspace target={target} />);
  expect(await screen.findByText("Document workspace blocked")).toBeInTheDocument();
  expect(screen.queryByText("Mobile home")).not.toBeInTheDocument();

  window.dispatchEvent(new Event("focus"));
  expect((await screen.findAllByText("Mobile home")).length).toBeGreaterThan(0);
});

it("lets a connected empty project create its first screen", async () => {
  runLocalOperationMock.mockImplementation(async (operation) => {
    if (operation.type === "list-documents") return emptyCatalog as never;
    throw new Error(`Unexpected operation ${operation.type}`);
  });

  render(<DocumentWorkspace target={target} />);

  expect(await screen.findByText("No screens yet")).toBeInTheDocument();
  expect(screen.queryByText("Document workspace blocked")).not.toBeInTheDocument();
  await userEvent.click(screen.getAllByRole("button", { name: "Create screen" })[0]!);
  expect(await screen.findByRole("dialog", { name: "Create screen" })).toBeInTheDocument();
});

it("shows a truthful empty Library and requires a fresh create diff after save failure", async () => {
  runLocalOperationMock.mockImplementation(async (operation) => {
    if (operation.type === "list-documents") return standaloneCatalog as never;
    if (operation.type === "read-document") return snapshot(standaloneScreen) as never;
    if (operation.type === "compile-tailwind") return { value: operation.value, css: "" } as never;
    if (operation.type === "prepare-document-create") return preparedCreation(operation.label) as never;
    if (operation.type === "save-document") {
      throw new LocalOperationError("CHALLENGE_EXPIRED", "The prepared creation expired.");
    }
    throw new Error(`Unexpected operation ${operation.type}`);
  });

  render(<DocumentWorkspace target={target} />);
  expect((await screen.findAllByText("Only screen")).length).toBeGreaterThan(0);
  await userEvent.click(screen.getAllByRole("button", { name: "Library" })[0]!);

  expect(await screen.findByText("No components are registered yet.")).toBeInTheDocument();
  expect(screen.queryByText("Only screen")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Reset document" })).toBeDisabled();
  await userEvent.click(screen.getAllByRole("button", { name: "Create component" })[0]!);
  expect(await screen.findByRole("dialog", { name: "Create component" })).toBeInTheDocument();
  await userEvent.type(screen.getByRole("textbox", { name: "Name" }), "Profile card");
  await userEvent.click(screen.getByRole("button", { name: "Review source" }));
  expect(await screen.findByRole("dialog", { name: "Exact source diff" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

  expect(await screen.findByRole("dialog", { name: "Create component" })).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent("Prepare a fresh source diff");
  expect(screen.queryByRole("dialog", { name: "Exact source diff" })).not.toBeInTheDocument();
});

it("keeps one item draft while canvas selection moves between rendered components", async () => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: query.includes("min-width"),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
  runLocalOperationMock.mockImplementation(async (operation) => {
    if (operation.type === "list-documents") return editingCatalog as never;
    if (operation.type === "read-document") return snapshot(editingScreen) as never;
    if (operation.type === "compile-tailwind") return { value: operation.value, css: ".p-4{padding:1rem}" } as never;
    throw new Error(`Unexpected operation ${operation.type}`);
  });

  render(<DocumentWorkspace target={target} />);
  const alpha = await screen.findByText("Alpha");
  fireEvent.doubleClick(alpha);
  const content = await screen.findByRole("textbox", { name: "Content" });
  await userEvent.clear(content);
  await userEvent.type(content, "Alpha draft");
  expect(screen.getByRole("button", { name: "Reset document" })).toBeDisabled();

  fireEvent.click(screen.getByText("Beta"));
  await waitFor(() => expect(screen.getByRole("textbox", { name: "Content" })).toHaveValue("Beta"));

  fireEvent.click(screen.getByText("Alpha draft"));
  await waitFor(() => expect(screen.getByRole("textbox", { name: "Content" })).toHaveValue("Alpha draft"));
});

function installServer(
  currentScreen: () => DesignDocument,
  onPrepare: (document: DesignDocument) => void,
  onSave: () => void,
): void {
  runLocalOperationMock.mockImplementation(async (operation) => {
    if (operation.type === "list-documents") return catalog as never;
    if (operation.type === "read-document") {
      const document = operation.documentId === screenDocument.id ? currentScreen() : panelDocument;
      return snapshot(document) as never;
    }
    if (operation.type === "compile-tailwind") {
      return { value: operation.value, css: ".p-4{padding:1rem}" } satisfies TailwindPreview as never;
    }
    if (operation.type === "prepare-document-save") {
      onPrepare(operation.document);
      return prepared(operation.document) as never;
    }
    if (operation.type === "save-document") {
      onSave();
      return saved(currentScreen()) as never;
    }
    throw new Error(`Unexpected operation ${operation.type}`);
  });
}

function snapshot(document: DesignDocument): DocumentSnapshot {
  return {
    documentId: document.id,
    document,
    documentDigest: digest(document.label === "Mobile home" && document.root.slots.body?.length === 0 ? "a" : "b"),
    sourceVersions: { [`source.${document.id}`]: digest(document.root.slots.body?.length ? "b" : "a") },
  };
}

function prepared(document: DesignDocument): PreparedDocumentSave {
  return {
    state: "ready",
    challengeId: "11111111-1111-4111-8111-111111111111",
    documentId: document.id,
    documentDigest: digest("b"),
    baseSourceVersions: { [`source.${document.id}`]: digest("a") },
    nextSourceVersions: { [`source.${document.id}`]: digest("b") },
    changes: [{
      fileId: `source.${document.id}`,
      label: "mobile.design.json",
      beforeVersion: digest("a"),
      nextVersion: digest("b"),
    }],
    diff: '+ "children": "Written from mobile"',
    strictUi: evidence(document.id),
    compile: { status: "passed", checkedAt: "2026-07-14T00:00:00.000Z" },
    transactionDigest: digest("c"),
    expiresAt: "2026-07-14T00:05:00.000Z",
  };
}

function saved(document: DesignDocument): SavedDocument {
  return {
    state: "saved",
    documentId: document.id,
    documentDigest: digest("b"),
    previousDocumentDigest: digest("a"),
    sourceVersions: { [`source.${document.id}`]: digest("b") },
    transactionDigest: digest("c"),
  };
}

function evidence(documentId: string) {
  return {
    id: "evidence.mobile",
    projectId: target.project.id,
    documentId,
    basis: { documentDigest: digest("b"), sourceVersion: digest("b"), ruleSetVersion: "mobile.v1" },
    status: "passed" as const,
    checkedAt: "2026-07-14T00:00:00.000Z",
    violations: [],
  };
}

function digest(character: string): string {
  return character.repeat(64);
}

const panelDocument: DesignDocument = {
  schemaVersion: 2,
  id: "component.panel",
  label: "Panel",
  kind: "component",
  component: {
    id: "panel",
    label: "Panel",
    group: "Surfaces",
    properties: [],
    slots: [{ id: "body", label: "Body", accepts: ["text"], acceptsText: false }],
  },
  root: {
    instanceId: "panel.template",
    adapterId: "stack",
    props: { className: "p-4" },
    slots: { content: [{ kind: "slot-outlet", id: "panel.outlet", slotId: "body" }] },
  },
};

const screenDocument: DesignDocument = {
  schemaVersion: 2,
  id: "screen.mobile",
  label: "Mobile home",
  kind: "screen",
  root: { instanceId: "panel.instance", adapterId: "panel", slots: { body: [] } },
};

const standaloneScreen: DesignDocument = {
  schemaVersion: 2,
  id: screenDocument.id,
  label: "Only screen",
  kind: "screen",
  root: { instanceId: "standalone.root", adapterId: "stack", slots: { content: [] } },
};

const editingScreen: DesignDocument = {
  schemaVersion: 2,
  id: "screen.editing",
  label: "Editing canvas",
  kind: "screen",
  root: {
    instanceId: "editing.root",
    adapterId: "stack",
    slots: {
      content: [
        { kind: "component", node: { instanceId: "text.alpha", adapterId: "text", props: { children: "Alpha" }, slots: {} } },
        { kind: "component", node: { instanceId: "text.beta", adapterId: "text", props: { children: "Beta" }, slots: {} } },
      ],
    },
  },
};

const createdComponent: DesignDocument = {
  schemaVersion: 2,
  id: "component.created",
  label: "Profile card",
  kind: "component",
  component: {
    id: "profile-card",
    label: "Profile card",
    group: "Surfaces",
    recipeId: "recipe.component.panel",
    properties: [],
    slots: [{ id: "body", label: "Body", accepts: ["text"], acceptsText: false }],
  },
  root: {
    instanceId: "created.template",
    adapterId: "stack",
    slots: { content: [{ kind: "slot-outlet", id: "created.body", slotId: "body" }] },
  },
};

const catalog: DocumentCatalog = {
  state: "catalog",
  documents: [
    { id: screenDocument.id, label: screenDocument.label, kind: "screen", origin: "registered" },
    { id: panelDocument.id, label: panelDocument.label, kind: "component", group: "Surfaces", origin: "registered" },
  ],
  recipes: [],
  files: [{ id: "mobile.source", label: "mobile.design.json", kind: "file" }],
};

const standaloneCatalog: DocumentCatalog = {
  state: "catalog",
  documents: [{ id: standaloneScreen.id, label: standaloneScreen.label, kind: "screen", origin: "registered" }],
  recipes: [{ id: "recipe.component.panel", label: "Panel component", kind: "component" }],
  files: [{ id: "standalone.source", label: "standalone.design.json", kind: "file" }],
};

const editingCatalog: DocumentCatalog = {
  state: "catalog",
  documents: [{ id: editingScreen.id, label: editingScreen.label, kind: "screen", origin: "registered" }],
  recipes: [],
  files: [{ id: "editing.source", label: "editing.design.json", kind: "file" }],
};

const emptyCatalog: DocumentCatalog = {
  state: "catalog",
  documents: [],
  recipes: [{ id: "recipe.screen.blank", label: "Blank screen", kind: "screen" }],
  files: [],
};

function preparedCreation(label: string): PreparedDocumentCreate {
  const document = {
    ...createdComponent,
    label,
    component: { ...createdComponent.component!, label },
  };
  return {
    state: "create-ready",
    challengeId: "22222222-2222-4222-8222-222222222222",
    documentId: document.id,
    createdDocument: document,
    documentDigest: digest("d"),
    nextSourceVersions: { "created.source": digest("d") },
    changes: [{ fileId: "created.source", label: "created.design.json", beforeVersion: null, nextVersion: digest("d") }],
    diff: `+ ${label}`,
    strictUi: evidence(document.id),
    compile: { status: "passed", checkedAt: "2026-07-14T00:00:00.000Z" },
    transactionDigest: digest("e"),
    expiresAt: "2026-07-14T00:05:00.000Z",
  };
}

const target: TargetModule = {
  project: { id: "mobile-workspace", label: "Mobile workspace" },
  defaultAdapterId: "stack",
  defaultDocumentId: screenDocument.id,
  defaultFixture: { instanceId: "legacy", adapterId: "stack", slots: { content: [] } },
  files: [],
  adapters: [
    {
      component: { id: "stack", label: "Stack", group: "Layout", slots: [{ id: "content", label: "Content", accepts: ["text", "card"], acceptsText: false }] },
      controls: [{ id: "surface", label: "Surface", kind: "tailwind", prop: "className" }],
      defaultProps: { className: "p-4" },
      render: (props, context) => <div {...context.slotAttributes.content} className={String(props.className ?? "")}>{context.slotChildren.content}</div>,
    },
    {
      component: { id: "text", label: "Text", group: "Typography", slots: [] },
      controls: [{ id: "content", label: "Content", kind: "text", prop: "children" }],
      defaultProps: { children: "New text" },
      render: (props) => <p>{String(props.children ?? "")}</p>,
    },
  ],
};
