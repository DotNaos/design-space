export type EditorPhase =
  | "preview-ready"
  | "draft-editing"
  | "diff-ready"
  | "saving"
  | "saved"
  | "stale"
  | "compile-error";

export interface PreparedEdit {
  readonly id: string;
  readonly sourceVersion: string;
  readonly draftValue: string;
  readonly exactDiff: string;
}

export interface StaleSource {
  readonly value: string;
  readonly version: string;
}

export interface CompileFailure {
  readonly message: string;
  readonly diagnostics?: readonly string[];
}

export interface EditorState {
  readonly phase: EditorPhase;
  readonly savedValue: string;
  readonly draftValue: string;
  readonly sourceVersion: string;
  readonly undoStack: readonly string[];
  readonly preparedEdit?: PreparedEdit;
  readonly staleSource?: StaleSource;
  readonly compileFailure?: CompileFailure;
}

export type EditorAction =
  | { readonly type: "edit"; readonly value: string }
  | { readonly type: "undo" }
  | { readonly type: "reset" }
  | {
      readonly type: "prepare-succeeded";
      readonly preparedEditId: string;
      readonly sourceVersion: string;
      readonly draftValue: string;
      readonly exactDiff: string;
    }
  | { readonly type: "save-started"; readonly preparedEditId: string }
  | {
      readonly type: "save-succeeded";
      readonly preparedEditId: string;
      readonly savedValue: string;
      readonly sourceVersion: string;
    }
  | { readonly type: "compile-failed"; readonly message: string; readonly diagnostics?: readonly string[] }
  | { readonly type: "source-changed"; readonly value: string; readonly sourceVersion: string }
  | { readonly type: "preview-ready" };

export function createEditorState(savedValue: string, sourceVersion: string): EditorState {
  return {
    phase: "preview-ready",
    savedValue,
    draftValue: savedValue,
    sourceVersion,
    undoStack: [],
  };
}

export function isDirty(state: EditorState): boolean {
  return state.draftValue !== state.savedValue;
}
