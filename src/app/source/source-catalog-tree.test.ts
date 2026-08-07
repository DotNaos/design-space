import { expect, it } from "vitest";

import type { SourceCatalogComponent } from "./source-library-catalog";
import { sourceCatalogTree } from "./source-catalog-tree";

const component = (
  id: string,
  label: string,
  path: readonly string[],
  folderIcons?: SourceCatalogComponent["folderIcons"],
): SourceCatalogComponent => ({
  category: "app",
  folderIcons,
  id,
  label,
  path,
  searchText: `${path.join(" ")} ${label}`.toLocaleLowerCase(),
});

it("builds folders only for real component descendants", () => {
  const tree = sourceCatalogTree([
    component("agents-card", "AgentCard", ["Agents", "AgentCard"], [{ name: "bot", path: ["Agents"] }]),
    component("agents-tools-call", "ToolCall", ["Agents", "Tools", "ToolCall"], [
      { name: "bot", path: ["Agents"] },
      { name: "wrench", path: ["Agents", "Tools"] },
    ]),
    component("git-card", "AgentCard", ["Git", "AgentCard"]),
    component("button", "Button", ["Button"]),
  ]);

  expect(tree).toMatchObject([
    {
      kind: "folder",
      label: "Agents",
      iconName: "bot",
      children: [
        { kind: "component", component: { id: "agents-card" } },
        {
          kind: "folder",
          label: "Tools",
          iconName: "wrench",
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

it("keeps the default folder icon when equivalent catalog paths disagree", () => {
  const tree = sourceCatalogTree([
    component("web-card", "Card", ["Shared", "Card"], [{ name: "globe", path: ["Shared"] }]),
    component("native-button", "Button", ["Shared", "Button"], [{ name: "smartphone", path: ["Shared"] }]),
  ]);

  expect(tree).toMatchObject([{ kind: "folder", label: "Shared", iconName: undefined }]);
});
