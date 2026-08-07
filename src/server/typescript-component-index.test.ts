import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { indexTypeScriptComponents } from "./typescript-component-index";
import { annotateSourceHtmlLayers } from "./source-layer-annotation";

describe("TypeScript component index", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
  });

  it("derives properties and slots from the exported component props type", async () => {
    const root = await createProject();
    const components = await indexTypeScriptComponents({
      filePaths: ["src/components/Panel.tsx"],
      projectRoot: root,
    });

    expect(components).toHaveLength(1);
    expect(components[0]).toMatchObject({
      exportName: "Panel",
      filePath: "src/components/Panel.tsx",
      label: "Panel",
      propsTypeText: "PanelProps",
      uses: ["PanelHeader"],
      layers: [{
        label: "section",
        kind: "html",
        className: expect.objectContaining({ value: "rounded-xl" }),
        children: [{
          label: "PanelHeader",
          kind: "component",
          children: [{
            label: "header",
            kind: "html",
            text: expect.objectContaining({ value: "Summary", syntax: "text" }),
            children: [],
          }],
        }],
      }],
    });
    expect(components[0]?.layers[0]?.children[0]?.className).toBeUndefined();

    const props = Object.fromEntries(components[0]!.props.map((prop) => [prop.name, prop]));
    expect(props.title).toMatchObject({
      kind: "string",
      required: false,
    });
    expect(props.mode).toMatchObject({
      kind: "string",
      required: true,
      type: '"compact" | "comfortable"',
    });
    expect(props.count).toMatchObject({ kind: "number", required: true });
    expect(props.disabled).toMatchObject({ kind: "boolean", required: false });
    expect(props.content).toMatchObject({ kind: "unknown", required: false, type: "ReactNode" });
    expect(props.children).toBeUndefined();
    expect(props.element).toMatchObject({ kind: "unknown", required: true });
    expect(props.elements).toMatchObject({ kind: "unknown", required: true });
    expect(props.strict).toMatchObject({ kind: "unknown", required: true });
    expect(props.strict.type).toContain('StrictUiChildren<"slot.header" | "slot.main">');
    expect(props.onPress).toMatchObject({ kind: "unknown", required: true });
    expect(components[0]!.slots).toEqual([]);
    expect(components[0]!.findings).toEqual([
      expect.objectContaining({ ruleId: "strict-ui.children-forbidden" }),
    ]);
  });

  it("does not treat non-components or non-exported declarations as components", async () => {
    const root = await createProject();
    const components = await indexTypeScriptComponents({
      filePaths: ["src/components/Other.tsx"],
      projectRoot: root,
    });

    expect(components).toEqual([]);
  });

  it("resolves props through ComponentType-based library wrappers", async () => {
    const root = await createProject();
    const components = await indexTypeScriptComponents({
      filePaths: ["src/components/WrappedPanel.tsx"],
      projectRoot: root,
    });

    expect(components).toHaveLength(1);
    expect(components[0]).toMatchObject({
      exportName: "WrappedPanel",
      propsTypeText: "PanelProps",
      uses: [],
      layers: [{
        label: "section",
        kind: "html",
      }],
    });
    expect(components[0]!.props.find((prop) => prop.name === "strict")).toMatchObject({
      kind: "unknown",
      required: true,
    });
  });

  it("only synthesizes className editing for JSX components whose props accept it", async () => {
    const root = await createProject();
    await writeFile(join(root, "src/components/ClassNameComposition.tsx"), `
      interface SurfaceProps { className?: string; }
      function Surface(_props: SurfaceProps) { return <section />; }
      function Plain() { return <span />; }
      export function Composition() { return <div><Surface /><Plain /></div>; }
    `);

    const components = await indexTypeScriptComponents({
      filePaths: ["src/components/ClassNameComposition.tsx"],
      projectRoot: root,
    });
    const composition = components.find((component) => component.exportName === "Composition");
    const surface = composition?.layers[0]?.children.find((layer) => layer.label === "Surface");
    const plain = composition?.layers[0]?.children.find((layer) => layer.label === "Plain");

    expect(surface?.className).toMatchObject({ value: "", insert: true });
    expect(plain?.className).toBeUndefined();
  });

  it("maps same-file component layers to their exact definitions", async () => {
    const root = await createProject();
    const source = `
      function ControlSection() {
        return <section>Controls</section>;
      }
      export function Inspector() {
        return <aside><ControlSection /></aside>;
      }
    `;
    await writeFile(join(root, "src/components/Inspector.tsx"), source);

    const components = await indexTypeScriptComponents({
      filePaths: ["src/components/Inspector.tsx"],
      projectRoot: root,
    });
    const controlSection = components[0]?.layers[0]?.children.find((layer) => layer.label === "ControlSection");

    expect(controlSection?.definition).toEqual({
      start: source.indexOf("function ControlSection"),
      end: source.indexOf("export function Inspector") - 7,
    });
    expect(controlSection?.definition).not.toEqual(controlSection?.source);
  });

  it("records the exact imported source export for duplicate component labels", async () => {
    const root = await createProject();
    await mkdir(join(root, "src/components/Agents"), { recursive: true });
    await mkdir(join(root, "src/components/Git"), { recursive: true });
    await writeFile(join(root, "src/components/Agents/AgentCard.tsx"), `
      export function AgentCard() { return <article>Agent</article>; }
    `);
    await writeFile(join(root, "src/components/Git/AgentCard.tsx"), `
      export function AgentCard() { return <article>Commit</article>; }
    `);
    await writeFile(join(root, "src/components/DuplicateComposition.tsx"), `
      import { AgentCard as AgentsCard } from "./Agents/AgentCard";
      import { AgentCard as GitCard } from "./Git/AgentCard";
      export function DuplicateComposition() { return <main><AgentsCard /><GitCard /></main>; }
    `);

    const components = await indexTypeScriptComponents({
      filePaths: [
        "src/components/Agents/AgentCard.tsx",
        "src/components/Git/AgentCard.tsx",
        "src/components/DuplicateComposition.tsx",
      ],
      projectRoot: root,
    });
    const composition = components.find((component) => component.exportName === "DuplicateComposition");

    expect(composition?.layers[0]?.children.map((layer) => layer.component)).toEqual([
      { relativePath: "src/components/Agents/AgentCard.tsx", exportName: "AgentCard" },
      { relativePath: "src/components/Git/AgentCard.tsx", exportName: "AgentCard" },
    ]);
  });

  it("keeps rendered JSX layer IDs stable when an earlier source edit shifts offsets", async () => {
    const root = await createProject();
    const filePath = join(root, "src/components/StableLayers.tsx");
    const source = `
      export function StableLayers() {
        return <main><section>First</section><button>Later</button></main>;
      }
    `;
    await writeFile(filePath, source);
    const relativePath = "src/components/StableLayers.tsx";
    const base = await indexTypeScriptComponents({ filePaths: [relativePath], projectRoot: root });
    const shiftedSource = source.replace("return <main>", 'return <main className="grid">');
    const shifted = await indexTypeScriptComponents({
      filePaths: [relativePath],
      projectRoot: root,
      sourceOverrides: new Map([[await realpath(filePath), shiftedSource]]),
    });
    const later = base[0]?.layers[0]?.children.find((layer) => layer.label === "button");
    const shiftedLater = shifted[0]?.layers[0]?.children.find((layer) => layer.label === "button");

    expect(shiftedLater?.source.start).not.toBe(later?.source.start);
    expect(shiftedLater?.id).toBe(later?.id);
    expect(annotateSourceHtmlLayers(source, "src/components/StableLayers.tsx")).toContain(
      `data-design-space-source-layer-id="${shiftedLater?.id}"`,
    );
  });

  it("indexes only explicit typed slots and flattens fragments", async () => {
    const root = await createProject();
    await writeFile(join(root, "src/components/StrictPanel.tsx"), `
      import { Fragment, type ReactElement } from "react";

      type ComponentSlot<T> = ReactElement & { readonly __accepts?: T };
      type ComponentSlotList<T, Min extends number = 0, Max extends number = number> =
        readonly ComponentSlot<T>[] & { readonly __cardinality?: readonly [Min, Max] };

      export function Heading() { return <h2>Heading</h2>; }
      export function Card() { return <article>Card</article>; }
      export function Button() { return <button>Save</button>; }

      export interface StrictPanelSlots {
        header: ComponentSlot<typeof Heading>;
        content: ComponentSlotList<typeof Card, 1, 3>;
        actions?: ComponentSlotList<typeof Button>;
      }

      export interface StrictPanelProps {
        label: string;
        slots: StrictPanelSlots;
        children?: never;
      }

      export function StrictPanel(props: StrictPanelProps) {
        return <Fragment>
          <section>
            <header>{props.slots.header}{props.slots.actions}</header>
            <main>{props.slots.content}</main>
          </section>
        </Fragment>;
      }
    `);

    const components = await indexTypeScriptComponents({
      filePaths: ["src/components/StrictPanel.tsx"],
      projectRoot: root,
    });
    const panel = components.find((component) => component.exportName === "StrictPanel");

    expect(panel).toBeDefined();
    expect(panel?.props).toEqual([
      expect.objectContaining({ name: "label", kind: "string", required: true }),
    ]);
    expect((panel as unknown as { slots: unknown }).slots).toEqual([
      expect.objectContaining({ name: "header", accepts: ["Heading"], min: 1, max: 1, multiple: false }),
      expect.objectContaining({ name: "content", accepts: ["Card"], min: 1, max: 3, multiple: true }),
      expect.objectContaining({ name: "actions", accepts: ["Button"], min: 0, multiple: true }),
    ]);
    expect((panel as unknown as { findings: unknown[] }).findings).toEqual([]);
    expect(panel?.layers).toEqual([{
      id: expect.any(String),
      label: "section",
      kind: "html",
      source: expect.any(Object),
      className: expect.any(Object),
      children: [{
        id: expect.any(String),
        label: "header",
        kind: "html",
        source: expect.any(Object),
        className: expect.any(Object),
        children: [
          expect.objectContaining({ label: "header", kind: "slot" }),
          expect.objectContaining({ label: "actions", kind: "slot" }),
        ],
      }, {
        id: expect.any(String),
        label: "main",
        kind: "html",
        source: expect.any(Object),
        className: expect.any(Object),
        children: [expect.objectContaining({ label: "content", kind: "slot" })],
      }],
    }]);
  });

  it("maps typed slot occupancy and validation from the caller JSX", async () => {
    const root = await createProject();
    await writeFile(join(root, "src/components/Composition.tsx"), `
      import type { ReactElement } from "react";
      type ComponentSlot<T> = ReactElement & { readonly __accepts?: T };
      type ComponentSlotList<T, Min extends number = 0, Max extends number = number> =
        readonly ComponentSlot<T>[] & { readonly __cardinality?: readonly [Min, Max] };
      export function Heading() { return <h2>Heading</h2>; }
      export function Card() { return <article>Card</article>; }
      export function Button() { return <button>Button</button>; }
      interface PanelProps {
        slots: {
          header: ComponentSlot<typeof Heading>;
          content: ComponentSlotList<typeof Card, 1, 2>;
          actions?: ComponentSlotList<typeof Button>;
        };
        children?: never;
      }
      export function Panel({ slots }: PanelProps) {
        return <section>{slots.header}{slots.content}{slots.actions}</section>;
      }
      export function App() {
        return <Panel slots={{ header: <Heading />, content: [<Card />] }} />;
      }
    `);

    const components = await indexTypeScriptComponents({
      filePaths: ["src/components/Composition.tsx"],
      projectRoot: root,
    });
    const app = components.find((component) => component.exportName === "App");
    const panel = app?.layers[0];

    expect(panel).toMatchObject({ label: "Panel", kind: "component" });
    expect(panel?.children).toEqual([
      expect.objectContaining({
        label: "header",
        kind: "slot",
        slot: expect.objectContaining({ validity: "full", received: ["Heading"] }),
        children: [expect.objectContaining({ label: "Heading", kind: "component" })],
      }),
      expect.objectContaining({
        label: "content",
        kind: "slot",
        slot: expect.objectContaining({ validity: "valid", received: ["Card"] }),
        children: [expect.objectContaining({ label: "Card", kind: "component" })],
      }),
      expect.objectContaining({
        label: "actions",
        kind: "slot",
        slot: expect.objectContaining({ validity: "optional", received: [] }),
      }),
    ]);
  });

  it("reports children instead of treating broad React content as a slot", async () => {
    const root = await createProject();
    await writeFile(join(root, "src/components/InvalidPanel.tsx"), `
      import type { ReactNode } from "react";
      export interface InvalidPanelProps { content?: ReactNode; children?: ReactNode; }
      export function InvalidPanel(props: InvalidPanelProps) {
        return <section>{props.content}{props.children}</section>;
      }
    `);

    const [panel] = await indexTypeScriptComponents({
      filePaths: ["src/components/InvalidPanel.tsx"],
      projectRoot: root,
    });

    expect(panel?.props).toEqual([
      expect.objectContaining({ name: "content", kind: "unknown" }),
    ]);
    expect((panel as unknown as { slots: unknown[] }).slots).toEqual([]);
    expect((panel as unknown as { findings: unknown[] }).findings).toEqual([
      expect.objectContaining({ ruleId: "strict-ui.children-forbidden", severity: "error" }),
    ]);
  });

  it("rejects explicit paths outside the trusted root, including symlinks", async () => {
    const root = await createProject();
    const outsideRoot = await mkdtemp(join(tmpdir(), "design-space-component-index-outside-"));
    roots.push(outsideRoot);
    const outsideFile = join(outsideRoot, "Outside.tsx");
    await writeFile(outsideFile, "export function Outside() { return <div />; }\n");

    await expect(indexTypeScriptComponents({
      filePaths: [outsideFile],
      projectRoot: root,
    })).rejects.toMatchObject({ code: "INVALID_REGISTRATION" });

    const linkedFile = join(root, "src/components/Linked.tsx");
    await symlink(outsideFile, linkedFile);
    await expect(indexTypeScriptComponents({
      filePaths: ["src/components/Linked.tsx"],
      projectRoot: root,
    })).rejects.toMatchObject({ code: "ACCESS_DENIED" });
  });

  async function createProject(): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), "design-space-component-index-"));
    roots.push(root);
    await symlink(join(process.cwd(), "node_modules"), join(root, "node_modules"), "dir");
    await mkdir(join(root, "src/components"), { recursive: true });
    await mkdir(join(root, "src/types"), { recursive: true });
    await writeFile(join(root, "tsconfig.json"), JSON.stringify({
      compilerOptions: {
        baseUrl: ".",
        jsx: "react-jsx",
        module: "ESNext",
        moduleResolution: "Bundler",
        paths: { "@fixture/*": ["src/types/*"] },
        strict: true,
      },
    }));
    await writeFile(join(root, "src/types/panel.ts"), `
      import type { JSX, ReactElement, ReactNode } from "react";

      export type StrictUiChild<K extends string> = ReactElement<{ kind: K }>;
      export type StrictUiChildren<K extends string> =
        | StrictUiChild<K>
        | readonly StrictUiChild<K>[];

      export interface PanelProps {
        title?: string;
        mode: "compact" | "comfortable";
        count: 1 | 2;
        disabled: boolean | undefined;
        content: ReactNode;
        children?: ReactNode;
        element: JSX.Element;
        elements: readonly ReactElement[];
        strict: StrictUiChildren<"slot.header" | "slot.main">;
        onPress: () => void;
      }
    `);
    await writeFile(join(root, "src/components/Panel.tsx"), `
      import type { PanelProps } from "@fixture/panel";

      function PanelHeader() { return <header>Summary</header>; }
      export function Panel(props: PanelProps) {
        return <section className="rounded-xl"><PanelHeader />{props.title}{props.content}{props.children}</section>;
      }
    `);
    await writeFile(join(root, "src/components/Other.tsx"), `
      export function Calculate(value: number) { return value * 2; }
      export function helper() { return <span>Helper</span>; }
      function Hidden() { return <span>Hidden</span>; }
      void Hidden;
    `);
    await writeFile(join(root, "src/components/WrappedPanel.tsx"), `
      import type { ComponentType } from "react";
      import type { PanelProps } from "@fixture/panel";

      type TaggedComponent<P> = ComponentType<P> & { readonly kind: "panel" };
      const implementation = ((props: PanelProps) => (
        <section>{props.title}{props.content}</section>
      )) as TaggedComponent<PanelProps>;
      export const WrappedPanel = implementation;
    `);
    return root;
  }
});
