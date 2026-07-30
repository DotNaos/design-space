import { expect, it, vi } from "vitest";

import type { DocumentService } from "./document-service";
import type { EditService } from "./edit-service";
import { LocalOperationService, type OperationExecutor } from "./local-operation-service";

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

it("routes library development operations and attaches the live server", async () => {
  const libraryExecute = vi.fn(async () => ({ state: "stopped" }));
  const attachServer = vi.fn();
  const libraryService = { execute: libraryExecute, attachServer } satisfies OperationExecutor;
  const service = new LocalOperationService(
    { execute: vi.fn() } as unknown as EditService,
    { execute: vi.fn() } as unknown as DocumentService,
    libraryService,
  );
  const server = { restart: vi.fn() };

  service.attachServer(server as never);
  await expect(service.execute({ type: "get-library-development" })).resolves.toEqual({ state: "stopped" });

  expect(attachServer).toHaveBeenCalledWith(server);
  expect(libraryExecute).toHaveBeenCalledWith({ type: "get-library-development" });
});

it("disposes the edit service once and rejects operations after shutdown", async () => {
  const editDispose = vi.fn();
  const service = new LocalOperationService(
    { execute: vi.fn(), dispose: editDispose } as unknown as EditService,
    { execute: vi.fn() } as unknown as DocumentService,
  );

  service.dispose();
  service.dispose();

  expect(editDispose).toHaveBeenCalledTimes(1);
  await expect(service.execute({ type: "list-documents" })).rejects.toMatchObject({
    code: "VALIDATION_ERROR",
  });
});
