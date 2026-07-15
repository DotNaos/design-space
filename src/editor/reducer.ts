import type { EditorAction, EditorState } from "./state";
import { isDirty } from "./state";

function editingPhase(state: EditorState, nextValue: string): EditorState["phase"] {
  return nextValue === state.savedValue ? "preview-ready" : "draft-editing";
}

function edit(state: EditorState, value: string): EditorState {
  if (value === state.draftValue) return state;

  return {
    ...state,
    phase: state.phase === "stale" ? "stale" : editingPhase(state, value),
    draftValue: value,
    undoStack: [...state.undoStack, state.draftValue],
    preparedEdit: undefined,
    compileFailure: undefined,
  };
}

function undo(state: EditorState): EditorState {
  const previous = state.undoStack.at(-1);
  if (previous === undefined) return state;

  const nextStack = state.undoStack.slice(0, -1);
  if (state.phase === "stale") {
    const matchesLatestSource = previous === state.staleSource?.value;
    if (!matchesLatestSource) {
      return { ...state, draftValue: previous, undoStack: nextStack, preparedEdit: undefined };
    }

    return {
      ...state,
      phase: "preview-ready",
      savedValue: previous,
      draftValue: previous,
      sourceVersion: state.staleSource?.version ?? state.sourceVersion,
      undoStack: [],
      preparedEdit: undefined,
      staleSource: undefined,
      compileFailure: undefined,
    };
  }

  return {
    ...state,
    phase: editingPhase(state, previous),
    draftValue: previous,
    undoStack: nextStack,
    preparedEdit: undefined,
    compileFailure: undefined,
  };
}

function reset(state: EditorState): EditorState {
  const latest = state.staleSource;
  return {
    ...state,
    phase: "preview-ready",
    savedValue: latest?.value ?? state.savedValue,
    draftValue: latest?.value ?? state.savedValue,
    sourceVersion: latest?.version ?? state.sourceVersion,
    undoStack: [],
    preparedEdit: undefined,
    staleSource: undefined,
    compileFailure: undefined,
  };
}

function sourceChanged(
  state: EditorState,
  action: Extract<EditorAction, { type: "source-changed" }>,
): EditorState {
  if (action.sourceVersion === state.sourceVersion) return state;

  if (isDirty(state) || state.preparedEdit !== undefined || state.phase === "saving") {
    return {
      ...state,
      phase: "stale",
      preparedEdit: undefined,
      staleSource: { value: action.value, version: action.sourceVersion },
      compileFailure: undefined,
    };
  }

  return {
    ...state,
    phase: "preview-ready",
    savedValue: action.value,
    draftValue: action.value,
    sourceVersion: action.sourceVersion,
    undoStack: [],
    preparedEdit: undefined,
    staleSource: undefined,
    compileFailure: undefined,
  };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "edit":
      return edit(state, action.value);
    case "undo":
      return undo(state);
    case "reset":
      return reset(state);
    case "prepare-succeeded":
      if (state.phase === "stale") return state;
      if (action.draftValue !== state.draftValue) return state;
      if (action.sourceVersion !== state.sourceVersion) {
        return { ...state, phase: "stale", preparedEdit: undefined };
      }
      if (!isDirty(state)) return state;
      return {
        ...state,
        phase: "diff-ready",
        preparedEdit: {
          id: action.preparedEditId,
          sourceVersion: action.sourceVersion,
          draftValue: action.draftValue,
          exactDiff: action.exactDiff,
        },
        compileFailure: undefined,
      };
    case "save-started":
      if (state.preparedEdit?.id !== action.preparedEditId) return state;
      return { ...state, phase: "saving" };
    case "save-succeeded":
      if (state.preparedEdit?.id !== action.preparedEditId) return state;
      return {
        phase: "saved",
        savedValue: action.savedValue,
        draftValue: action.savedValue,
        sourceVersion: action.sourceVersion,
        undoStack: [],
      };
    case "compile-failed":
      return {
        ...state,
        phase: "compile-error",
        preparedEdit: undefined,
        compileFailure: { message: action.message, diagnostics: action.diagnostics },
      };
    case "source-changed":
      return sourceChanged(state, action);
    case "preview-ready":
      if (state.phase !== "saved") return state;
      return { ...state, phase: "preview-ready" };
  }
}
