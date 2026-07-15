import { useState } from "react";

import type { DesignDocument } from "../../shared/design-document";
import type { PreparedDocumentCreate } from "../../shared/document-transactions";
import type { DocumentWorkspaceController } from "./use-document-workspace";

type ReadyDocumentCreate = Extract<PreparedDocumentCreate, { state: "create-ready" }>;

export function useDocumentCreationFlow(options: {
  prepareCreate: DocumentWorkspaceController["prepareCreate"];
  saveCreate: DocumentWorkspaceController["saveCreate"];
  onCreated: (document: DesignDocument) => void;
}) {
  const [isOpen, setOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [prepared, setPrepared] = useState<ReadyDocumentCreate>();

  const open = () => {
    setError(undefined);
    setOpen(true);
  };

  const prepare = async (recipeId: string, label: string) => {
    setPreparing(true);
    setError(undefined);
    try {
      const result = await options.prepareCreate(recipeId, label);
      if (!result) {
        setError("The local target could not prepare this document.");
      } else if (result.state === "strict-blocked") {
        setError(result.strictUi.violations[0]?.message ?? "Strict UI blocked this starting structure.");
      } else if (result.state === "compile-blocked") {
        setError(result.compile.message ?? "The target could not compile this starting structure.");
      } else {
        setOpen(false);
        setPrepared(result);
      }
    } catch {
      setError("The local target could not prepare this document.");
    } finally {
      setPreparing(false);
    }
  };

  const save = async () => {
    const creation = prepared;
    if (!creation) return;
    setSaving(true);
    let saved = false;
    try {
      saved = Boolean(await options.saveCreate(creation.challengeId, creation.documentId));
    } catch {
      saved = false;
    } finally {
      setSaving(false);
      setPrepared(undefined);
    }
    if (!saved) {
      setError("The one-time save could not be completed. Prepare a fresh source diff to try again.");
      setOpen(true);
      return;
    }
    options.onCreated(creation.createdDocument);
  };

  return {
    isOpen,
    preparing,
    saving,
    error,
    prepared,
    open,
    close: () => setOpen(false),
    prepare,
    discard: () => setPrepared(undefined),
    save,
  };
}
