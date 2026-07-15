import { describe, expect, it } from "vitest";

import type { TargetModule } from "../shared/target-module";
import { collectTailwindValues } from "./use-item-editor";

describe("item editor session", () => {
  it("compiles Tailwind values for every edited instance and target-owned property", () => {
    const target: TargetModule = {
      project: { id: "controls", label: "Controls" },
      defaultAdapterId: "root",
      defaultFixture: {
        instanceId: "root-instance",
        adapterId: "root",
        props: { className: "old-root" },
        slots: {
          content: [{
            kind: "component",
            node: { instanceId: "child", adapterId: "copy", props: { classes: "text-lg" }, slots: {} },
          }],
        },
      },
      files: [],
      adapters: [
        {
          component: { id: "root", label: "Root", group: "Layout", slots: [{ id: "content", label: "Content" }] },
          controls: [{ id: "root-style", label: "Classes", kind: "tailwind", prop: "className" }],
          render: (_props, context) => <main>{context.slotChildren.content}</main>,
        },
        {
          component: { id: "copy", label: "Copy", group: "Content", slots: [] },
          controls: [{ id: "copy-style", label: "Classes", kind: "tailwind", prop: "classes" }],
          render: () => <p>Copy</p>,
        },
      ],
    };

    expect(collectTailwindValues(target, target.defaultFixture, "bg-zinc-950")).toBe("bg-zinc-950 text-lg");
  });
});
