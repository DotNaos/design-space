import { expect, it } from "vitest";

import type { SourceCatalogComponent } from "./source-library-catalog";
import { sourceCatalogTree } from "./source-catalog-tree";

const component = (id: string, label: string, path: readonly string[]): SourceCatalogComponent => ({
  category: "app",
  id,
  label,
  path,
  searchText: `${path.join(" ")} ${label}`.toLocaleLowerCase(),
});

it("builds folders only for real component descendants", () => {
  const tree = sourceCatalogTree([
    component("agents-card", "AgentCard", ["Agents", "AgentCard"]),
    component("agents-tools-call", "ToolCall", ["Agents", "Tools", "ToolCall"]),
    component("git-card", "AgentCard", ["Git", "AgentCard"]),
    component("button", "Button", ["Button"]),
  ]);

  expect(tree).toMatchObject([
    {
      kind: "folder",
      label: "Agents",
      children: [
        { kind: "component", component: { id: "agents-card" } },
        {
          kind: "folder",
          label: "Tools",
          children: [{ kind: "component", component: { id: "agents-tools-call" } }],
        },
      ],
    },
    { kind: "component", component: { id: "button" } },
    {
      kind: "folder",
      label: "Git",
      children: [{ kind: "component", component: { id: "git-card" } }],
    },
  ]);
});
