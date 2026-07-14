import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { slotSelectionId } from "../model";
import type { TailwindPreview } from "../shared/contracts";
import type { DesignDocument } from "../shared/design-document";
import type {
  DocumentCatalog,
  DocumentSnapshot,
  PreparedDocumentSave,
  SavedDocument,
} from "../shared/document-transactions";
import type { TargetModule } from "../shared/target-module";
import { runLocalOperation } from "./api";
import { DocumentWorkspace } from "./DocumentWorkspace";

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return { ...actual, runLocalOperation: vi.fn() };
});

const runLocalOperationMock = vi.mocked(runLocalOperation);
const originalMatchMedia = window.matchMedia;

beforeEach(() => {
  window.localStorage.clear();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
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
    slots: [{ id: "body", label: "Body" }],
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

const catalog: DocumentCatalog = {
  state: "catalog",
  documents: [
    { id: screenDocument.id, label: screenDocument.label, kind: "screen", origin: "registered" },
    { id: panelDocument.id, label: panelDocument.label, kind: "component", group: "Surfaces", origin: "registered" },
  ],
  recipes: [],
  files: [{ id: "mobile.source", label: "mobile.design.json", kind: "file" }],
};

const target: TargetModule = {
  project: { id: "mobile-workspace", label: "Mobile workspace" },
  defaultAdapterId: "stack",
  defaultDocumentId: screenDocument.id,
  defaultFixture: { instanceId: "legacy", adapterId: "stack", slots: { content: [] } },
  files: [],
  adapters: [
    {
      component: { id: "stack", label: "Stack", group: "Layout", slots: [{ id: "content", label: "Content" }] },
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
