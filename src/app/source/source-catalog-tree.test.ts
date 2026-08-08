import { expect, it } from "vitest";

import type { SourceCatalogComponent } from "./source-library-catalog";
import { sourceCatalogTree } from "./source-catalog-tree";

const component = (
  id: string,
  label: string,
  path: readonly string[],
  folderIcons?: SourceCatalogComponent["folderIcons"],
  packagePaths?: SourceCatalogComponent["packagePaths"],
): SourceCatalogComponent => ({
  category: "app",
  folderIcons,
  id,
  label,
  packagePaths,
  path,
  searchText: `${path.join(" ")} ${label}`.toLocaleLowerCase(),
});

it("builds folders only for real component descendants", () => {
  const tree = sourceCatalogTree([
    component("agents-card", "AgentCard", ["Agents", "AgentCard"], [{ name: "bot", path: ["Agents"] }], [["Agents"]]),
    component("agents-tools-call", "ToolCall", ["Agents", "Tools", "ToolCall"], [
      { name: "bot", path: ["Agents"] },
      { name: "wrench", path: ["Agents", "Tools"] },
    ], [["Agents"]]),
    component("git-card", "AgentCard", ["Git", "AgentCard"]),
    component("button", "Button", ["Button"]),
  ]);

  expect(tree).toMatchObject([
    { kind: "component", component: { id: "button" } },
    {
      kind: "folder",
      label: "Git",
      children: [{ kind: "component", component: { id: "git-card" } }],
    },
    {
      kind: "folder",
      label: "Agents",
      iconName: "bot",
      isPackage: true,
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
  ]);
});

it("keeps the default folder icon when equivalent catalog paths disagree", () => {
  const tree = sourceCatalogTree([
    component("web-card", "Card", ["Shared", "Card"], [{ name: "globe", path: ["Shared"] }]),
    component("native-button", "Button", ["Shared", "Button"], [{ name: "smartphone", path: ["Shared"] }]),
  ]);

  expect(tree).toMatchObject([{ kind: "folder", label: "Shared", iconName: undefined }]);
});

it("keeps a package folder visible when it contains one direct component", () => {
  const tree = sourceCatalogTree([
    component("chat-panel", "ChatPanel", ["Chat", "ChatPanel"], undefined, [["Chat"]]),
    component("button", "Button", ["Button"]),
  ]);

  expect(tree).toMatchObject([
    { kind: "component", component: { id: "button" } },
    {
      kind: "folder",
      label: "Chat",
      isPackage: true,
      children: [{ kind: "component", component: { id: "chat-panel" } }],
    },
  ]);
});
