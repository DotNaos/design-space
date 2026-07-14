import { expect, it, vi } from "vitest";

import type { DocumentService } from "./document-service";
import type { EditService } from "./edit-service";
import { LocalOperationService } from "./local-operation-service";

it("routes only typed legacy and document operations to their isolated services", async () => {
  const editExecute = vi.fn(async () => ({ kind: "edit" }));
  const documentExecute = vi.fn(async () => ({ kind: "document" }));
  const service = new LocalOperationService(
    { execute: editExecute } as unknown as EditService,
    { execute: documentExecute } as unknown as DocumentService,
  );

  await expect(service.execute({ type: "read-source", editTargetId: "card.surface" })).resolves.toEqual({ kind: "edit" });
  await expect(service.execute({ type: "list-documents" })).resolves.toEqual({ kind: "document" });
  await expect(service.execute({ type: "read-document", documentId: "screen.home" })).resolves.toEqual({ kind: "document" });
  await expect(service.execute({
    type: "prepare-document-create",
    recipeId: "blank-screen",
    label: "Settings",
  })).resolves.toEqual({ kind: "document" });
  await expect(service.execute({ type: "read-document", documentId: "screen.home", path: "/etc/passwd" })).rejects.toMatchObject({
    code: "INVALID_REQUEST",
  });
  expect(editExecute).toHaveBeenCalledTimes(1);
  expect(documentExecute).toHaveBeenCalledTimes(3);
});
