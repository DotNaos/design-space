import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { indexTypeScriptComponents } from "./typescript-component-index";

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
    });

    const props = Object.fromEntries(components[0]!.props.map((prop) => [prop.name, prop]));
    expect(props.title).toMatchObject({
      kind: "string",
      required: false,
      slot: false,
    });
    expect(props.mode).toMatchObject({
      kind: "string",
      required: true,
      slot: false,
      type: '"compact" | "comfortable"',
    });
    expect(props.count).toMatchObject({ kind: "number", required: true, slot: false });
    expect(props.disabled).toMatchObject({ kind: "boolean", required: false, slot: false });

    expect(props.content).toMatchObject({
      kind: "unknown",
      multiple: true,
      required: false,
      slot: true,
      type: "ReactNode",
    });
    expect(props.children).toMatchObject({ multiple: true, required: false, slot: true });
    expect(props.element).toMatchObject({ required: true, slot: true });
    expect(props.element).not.toHaveProperty("multiple");
    expect(props.elements).toMatchObject({ multiple: true, required: true, slot: true });
    expect(props.strict).toMatchObject({ multiple: true, required: true, slot: true });
    expect(props.strict.type).toContain('StrictUiChildren<"slot.header" | "slot.main">');
    expect(props.onPress).toMatchObject({ kind: "unknown", required: true, slot: false });
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
    });
    expect(components[0]!.props.find((prop) => prop.name === "strict")).toMatchObject({
      multiple: true,
      slot: true,
    });
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

      export function Panel(props: PanelProps) {
        return <section>{props.title}{props.content}{props.children}</section>;
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
