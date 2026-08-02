import { useState } from "react";

import type {
  PreparedSourceComponentCreate,
  SavedSourceComponentCreate,
} from "../../shared/contracts";
import { runLocalOperation } from "../api";

export function useSourceComponentCreation() {
  const [isOpen, setOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [prepared, setPrepared] = useState<PreparedSourceComponentCreate>();

  const open = () => {
    setError(undefined);
    setOpen(true);
  };

  const prepare = async (name: string) => {
    setPreparing(true);
    setError(undefined);
    try {
      const result = await runLocalOperation<PreparedSourceComponentCreate>({
        type: "prepare-source-component-create",
        name,
      });
      setOpen(false);
      setPrepared(result);
    } catch (reason) {
      setError(messageFor(reason));
    } finally {
      setPreparing(false);
    }
  };

  const save = async () => {
    if (!prepared) return undefined;
    setSaving(true);
    setError(undefined);
    try {
      const result = await runLocalOperation<SavedSourceComponentCreate>({
        type: "save-source-component-create",
        challengeId: prepared.challengeId,
      });
      setPrepared(undefined);
      return result;
    } catch (reason) {
      setPrepared(undefined);
      setOpen(true);
      setError(messageFor(reason));
      return undefined;
    } finally {
      setSaving(false);
    }
  };

  return {
    close: () => setOpen(false),
    discard: () => setPrepared(undefined),
    error,
    isOpen,
    open,
    prepare,
    prepared,
    preparing,
    save,
    saving,
  };
}

function messageFor(reason: unknown): string {
  return reason instanceof Error ? reason.message : "The source component could not be created.";
}
