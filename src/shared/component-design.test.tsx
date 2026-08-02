import { expect, it } from "vitest";
import type { ReactNode } from "react";

import { defineComponentDesign, type ComponentDesignOptions } from "./component-design";

function Badge(_: { tone: "neutral" | "success"; label: string; children?: never }) {
  return null;
}

function Panel(_: { content: ReactNode; tone?: "quiet" | "strong"; children?: never }) {
  return null;
}

if (false) {
  // @ts-expect-error initialState must name a key from states.
  defineComponentDesign(Badge, {
    isStateful: true,
    initialState: "missing",
    defaults: { tone: "neutral", label: "Status" },
    states: { idle: {} },
    render: (props) => <Badge {...props} />,
  });
}

it("normalizes stateless designs without redeclaring component properties", () => {
  const design = defineComponentDesign(Badge, {
    defaults: { tone: "neutral", label: "Status" },
    preview: { background: "#141518", minHeight: 320, padding: 24, width: 480, layout: "center" },
    designs: { default: {}, success: { tone: "success" } },
    render: (props) => <Badge {...props} />,
  });

  expect(design).toMatchObject({ isStateful: false, initialCase: "default" });
  expect(design.cases.success).toEqual({ tone: "success" });
  expect(design.preview).toEqual({
    background: "#141518",
    minHeight: 320,
    padding: 24,
    width: 480,
    layout: "center",
  });
});

it("keeps JSX content in named typed props presets", () => {
  const design = defineComponentDesign(Panel, {
    defaults: { content: null, tone: "quiet" },
    designs: {
      default: {},
      withButton: {
        content: <button type="button">Continue</button>,
        tone: "strong",
      },
    },
    render: (props) => <Panel {...props} />,
  });

  expect(design.cases.withButton.tone).toBe("strong");
  expect(design.cases.withButton.content).toMatchObject({
    type: "button",
    props: { children: "Continue", type: "button" },
  });
});

it("requires a declared initial state at runtime", () => {
  const unsafeDefineComponentDesign = defineComponentDesign as unknown as (
    component: typeof Badge,
    options: ComponentDesignOptions<typeof Badge>,
  ) => unknown;
  const invalid = {
    isStateful: true,
    initialState: "missing",
    defaults: { tone: "neutral", label: "Status" },
    states: { idle: {} },
    render: (props: Parameters<typeof Badge>[0]) => <Badge {...props} />,
  } as unknown as ComponentDesignOptions<typeof Badge>;
  expect(() => unsafeDefineComponentDesign(Badge, invalid)).toThrow(/Initial component design state missing/);
});
