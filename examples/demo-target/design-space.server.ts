import { canonicalJson } from "../../src/shared/canonical-json";
import { designDocumentSchema, type DesignDocument } from "../../src/shared/design-document";
import { collectDocumentTailwind } from "../../src/shared/document-tailwind";
import { validateStrictUi } from "../../src/model/strict-ui";
import { compileTailwindPreview } from "../../src/server/tailwind-preview";
import type { DocumentTargetContext, TailwindCompilerContext } from "../../src/server/target-registration";
import { target } from "./design-space.config";

export const registration = {
  project: { id: "demo-target", label: "Design Space demo target" },
  targetModule: "design-space.config.tsx",
  files: {
    "card.source": "src/Card.tsx",
    "tailwind.theme": "src/theme.css",
    "dashboard.document": "src/dashboard.design.json",
    "panel.document": "src/panel.design.json",
  },
  editTargets: {
    "card.surface": {
      fileId: "card.source",
      marker: "cardSourceClassName = ",
      compiler: "tsx",
    },
  },
  tailwindCompiler: {
    sourceFileIds: ["tailwind.theme"],
    compile: compileDemoTailwind,
  },
  documentRegistration: {
    version: "demo.strict-ui.v1",
    tailwindClassList: (document: DesignDocument, context: DocumentTargetContext) =>
      collectDocumentTailwind(target, context.libraryDocuments, document.root),
    documents: {
      "screen.dashboard": documentTarget("dashboard.document"),
      "component.panel": documentTarget("panel.document"),
    },
    managed: {
      directory: "src/design-space-documents",
      recipes: {
        "blank-screen": {
          label: "Blank screen",
          description: "Start a new app screen with the target-owned Stack adapter.",
          kind: "screen",
          create: ({ documentId, label }: { documentId: string; label: string }) => blankScreen(documentId, label),
        },
        "stack-component": {
          label: "Stack component",
          description: "Create a reusable component with one explicit content slot.",
          kind: "component",
          create: ({ documentId, label }: { documentId: string; label: string }) => stackComponent(documentId, label),
        },
      },
      strictUi: (document: DesignDocument, context: DocumentTargetContext) =>
        validateStrictUi(target, document, context.libraryDocuments),
      compile: (sources: Readonly<Record<string, string>>) => {
        for (const source of Object.values(sources)) designDocumentSchema.parse(JSON.parse(source));
      },
    },
  },
};

const demoUtilities = new Map([
  ["surface", "tailwind.theme"],
]);

async function compileDemoTailwind(classList: string, context: TailwindCompilerContext): Promise<string> {
  const stockClasses: string[] = [];
  const customCss: string[] = [];
  for (const token of classList.split(" ").filter(Boolean)) {
    const fileId = demoUtilities.get(token);
    if (fileId) customCss.push(context.sources[fileId]);
    else stockClasses.push(token);
  }
  const stock = await compileTailwindPreview(stockClasses.join(" "));
  return [stock.css, ...customCss].filter(Boolean).join("\n");
}

function documentTarget(fileId: string) {
  return {
    sourceFileIds: [fileId],
    writeFileIds: [fileId],
    load: (sources: Readonly<Record<string, string>>) => JSON.parse(sources[fileId]),
    materialize: (document: DesignDocument) => ({
      [fileId]: `${canonicalJson(designDocumentSchema.parse(document), 2)}\n`,
    }),
    strictUi: (document: DesignDocument, context: DocumentTargetContext) =>
      validateStrictUi(target, document, context.libraryDocuments),
    compile: (sources: Readonly<Record<string, string>>) => {
      designDocumentSchema.parse(JSON.parse(sources[fileId]));
    },
  };
}

function blankScreen(documentId: string, label: string): DesignDocument {
  const uuid = documentId.slice("screen.".length);
  return {
    schemaVersion: 2,
    id: documentId,
    label,
    kind: "screen",
    root: {
      instanceId: `screen-root-${uuid}`,
      adapterId: "stack",
      props: { className: "flex min-h-screen flex-col gap-4 p-6" },
      slots: { content: [] },
    },
  };
}

function stackComponent(documentId: string, label: string): DesignDocument {
  const uuid = documentId.slice("component.".length);
  return {
    schemaVersion: 2,
    id: documentId,
    label,
    kind: "component",
    component: {
      id: `authored-${uuid}`,
      label,
      group: "Custom",
      recipeId: "stack-component",
      properties: [{
        id: "surface",
        label: "Surface",
        prop: "className",
        kind: "tailwind",
        section: "style",
        defaultValue: "flex flex-col gap-3",
      }],
      slots: [{ id: "content", label: "Content", min: 0, acceptsText: true }],
    },
    root: {
      instanceId: `component-root-${uuid}`,
      adapterId: "stack",
      props: { className: "flex flex-col gap-3" },
      propertyBindings: { className: "surface" },
      slots: {
        content: [{ kind: "slot-outlet", id: `content-outlet-${uuid}`, slotId: "content" }],
      },
    },
  };
}
