import { expect, it } from "vitest";

import { defineComponentDesign, type ComponentDesignOptions } from "./component-design";

function Badge(_: { tone: "neutral" | "success"; label: string; children?: never }) {
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
    designs: { default: {}, success: { tone: "success" } },
    render: (props) => <Badge {...props} />,
  });

  expect(design).toMatchObject({ isStateful: false, initialCase: "default" });
  expect(design.cases.success).toEqual({ tone: "success" });
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
