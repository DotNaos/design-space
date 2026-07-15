import { expect, it } from "vitest";

import { documentOperationSchema } from "./document-transactions";

it("accepts only opaque document operations without browser-selected paths or output files", () => {
  const version = "a".repeat(64);
  expect(documentOperationSchema.safeParse({ type: "list-documents" }).success).toBe(true);
  expect(documentOperationSchema.safeParse({ type: "read-document", documentId: "screen.home" }).success).toBe(true);
  expect(documentOperationSchema.safeParse({
    type: "prepare-document-create",
    recipeId: "blank-screen",
    label: "Settings",
  }).success).toBe(true);
  for (const attempt of [
    { type: "list-documents", root: "/tmp/other-project" },
    { type: "prepare-document-create", recipeId: "blank-screen", label: "Settings", path: "../../outside.tsx" },
    { type: "prepare-document-create", recipeId: "blank-screen", label: "Settings", moduleName: "evil-package" },
    { type: "prepare-document-create", recipeId: "blank-screen", label: "Settings", command: "touch /tmp/owned" },
    { type: "read-document", documentId: "screen.home", path: "/etc/passwd" },
    { type: "save-document", challengeId: crypto.randomUUID(), command: "rm -rf" },
    {
      type: "prepare-document-save",
      documentId: "screen.home",
      baseDocumentDigest: version,
      baseSourceVersions: { "screen.source": version },
      outputFileIds: ["secret"],
      document: {
        schemaVersion: 2,
        id: "screen.home",
        label: "Home",
        kind: "screen",
        root: { instanceId: "home.root", adapterId: "stack", slots: {} },
      },
    },
  ]) {
    expect(documentOperationSchema.safeParse(attempt).success).toBe(false);
  }
});
