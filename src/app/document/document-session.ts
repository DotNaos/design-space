import type { DesignDocument } from "../../shared/design-document";
import type { StrictUiEvidence } from "../../shared/strict-ui";
import { canonicalJson } from "../../shared/canonical-json";

export type SourceVersionMap = Readonly<Record<string, string>>;

export type PreparedDocumentView = {
  challengeId: string;
  documentDigest: string;
  exactDiff: string;
  expiresAt: string;
};

export type DocumentSessionPhase =
  | "ready"
  | "editing"
  | "checking"
  | "strict-blocked"
  | "compile-error"
  | "diff-ready"
  | "saving"
  | "saved"
  | "stale";

export interface DocumentSessionState {
  phase: DocumentSessionPhase;
  base: DesignDocument;
  draft: DesignDocument;
  baseDocumentDigest: string;
  sourceVersions: SourceVersionMap;
  past: readonly DesignDocument[];
  future: readonly DesignDocument[];
  strictUi?: StrictUiEvidence;
  prepared?: PreparedDocumentView;
  pendingCheckId?: string;
  error?: string;
  staleSnapshot?: {
    document: DesignDocument;
    documentDigest: string;
    sourceVersions: SourceVersionMap;
  };
}

export type DocumentSessionAction =
  | { type: "edit"; document: DesignDocument }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset" }
  | { type: "check-started"; checkId: string }
  | { type: "strict-blocked"; checkId: string; evidence: StrictUiEvidence }
  | { type: "compile-failed"; checkId: string; evidence: StrictUiEvidence; message: string }
  | { type: "prepare-succeeded"; checkId: string; evidence: StrictUiEvidence; prepared: PreparedDocumentView }
  | { type: "check-failed"; checkId: string }
  | { type: "save-started"; challengeId: string }
  | { type: "save-failed"; challengeId: string }
  | {
      type: "save-succeeded";
      challengeId: string;
      documentDigest: string;
      sourceVersions: SourceVersionMap;
    }
  | {
      type: "source-changed";
      document: DesignDocument;
      documentDigest: string;
      sourceVersions: SourceVersionMap;
    }
  | { type: "clear-saved" };

export function createDocumentSession(
  document: DesignDocument,
  baseDocumentDigest: string,
  sourceVersions: SourceVersionMap,
): DocumentSessionState {
  return {
    phase: "ready",
    base: document,
    draft: document,
    baseDocumentDigest,
    sourceVersions,
    past: [],
    future: [],
  };
}

export function documentSessionReducer(
  state: DocumentSessionState,
  action: DocumentSessionAction,
): DocumentSessionState {
  switch (action.type) {
    case "edit":
      if (sameDocument(action.document, state.draft)) return state;
      return invalidate({
        ...state,
        phase: state.phase === "stale" ? "stale" : sameDocument(action.document, state.base) ? "ready" : "editing",
        past: [...state.past, state.draft],
        future: [],
        draft: action.document,
      });
    case "undo": {
      const previous = state.past.at(-1);
      if (!previous) return state;
      return invalidate({
        ...state,
        phase: state.phase === "stale" ? "stale" : sameDocument(previous, state.base) ? "ready" : "editing",
        draft: previous,
        past: state.past.slice(0, -1),
        future: [state.draft, ...state.future],
      });
    }
    case "redo": {
      const next = state.future[0];
      if (!next) return state;
      return invalidate({
        ...state,
        phase: state.phase === "stale" ? "stale" : sameDocument(next, state.base) ? "ready" : "editing",
        draft: next,
        past: [...state.past, state.draft],
        future: state.future.slice(1),
      });
    }
    case "reset": {
      const latest = state.staleSnapshot;
      const document = latest?.document ?? state.base;
      return {
        phase: "ready",
        base: document,
        draft: document,
        baseDocumentDigest: latest?.documentDigest ?? state.baseDocumentDigest,
        sourceVersions: latest?.sourceVersions ?? state.sourceVersions,
        past: [],
        future: [],
      };
    }
    case "check-started":
      return state.phase === "stale" ? state : { ...invalidate(state), phase: "checking", pendingCheckId: action.checkId };
    case "strict-blocked":
      return state.phase !== "checking" || state.pendingCheckId !== action.checkId
        ? state
        : { ...state, phase: "strict-blocked", strictUi: action.evidence, prepared: undefined, pendingCheckId: undefined, error: undefined };
    case "compile-failed":
      return state.phase !== "checking" || state.pendingCheckId !== action.checkId
        ? state
        : { ...state, phase: "compile-error", strictUi: action.evidence, prepared: undefined, pendingCheckId: undefined, error: action.message };
    case "prepare-succeeded":
      if (
        state.phase !== "checking" ||
        state.pendingCheckId !== action.checkId ||
        action.prepared.documentDigest !== action.evidence.basis.documentDigest
      ) return state;
      return { ...state, phase: "diff-ready", strictUi: action.evidence, prepared: action.prepared, pendingCheckId: undefined, error: undefined };
    case "check-failed":
      if (state.phase !== "checking" || state.pendingCheckId !== action.checkId) return state;
      return { ...invalidate(state), phase: isDocumentDirty(state) ? "editing" : "ready" };
    case "save-started":
      return state.prepared?.challengeId === action.challengeId ? { ...state, phase: "saving" } : state;
    case "save-failed":
      if (state.phase !== "saving" || state.prepared?.challengeId !== action.challengeId) return state;
      return { ...invalidate(state), phase: isDocumentDirty(state) ? "editing" : "ready" };
    case "save-succeeded":
      if (state.prepared?.challengeId !== action.challengeId) return state;
      return {
        phase: "saved",
        base: state.draft,
        draft: state.draft,
        baseDocumentDigest: action.documentDigest,
        sourceVersions: action.sourceVersions,
        past: [],
        future: [],
        strictUi: state.strictUi,
      };
    case "source-changed":
      if (sameVersions(action.sourceVersions, state.sourceVersions)) return state;
      if (isDocumentDirty(state) || state.phase === "saving" || state.prepared) {
        return {
          ...invalidate(state),
          phase: "stale",
          staleSnapshot: {
            document: action.document,
            documentDigest: action.documentDigest,
            sourceVersions: action.sourceVersions,
          },
        };
      }
      return createDocumentSession(action.document, action.documentDigest, action.sourceVersions);
    case "clear-saved":
      return state.phase === "saved" ? { ...state, phase: "ready" } : state;
  }
}

export function isDocumentDirty(state: DocumentSessionState): boolean {
  return !sameDocument(state.draft, state.base);
}

function sameDocument(left: DesignDocument, right: DesignDocument): boolean {
  return left === right || canonicalJson(left) === canonicalJson(right);
}

function invalidate<T extends DocumentSessionState>(state: T): T {
  return { ...state, strictUi: undefined, prepared: undefined, pendingCheckId: undefined, error: undefined };
}

function sameVersions(left: SourceVersionMap, right: SourceVersionMap): boolean {
  const leftEntries = Object.entries(left);
  return leftEntries.length === Object.keys(right).length && leftEntries.every(([key, value]) => right[key] === value);
}
