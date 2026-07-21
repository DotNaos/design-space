import type { ReactNode } from "react";

export type SourceChangeReviewSnapshot = {
  preview: ReactNode;
  source: string;
};

export type SourceChangeReviewItem = {
  after: SourceChangeReviewSnapshot;
  before: SourceChangeReviewSnapshot;
  defaultIncluded?: boolean;
  digest: string;
  id: string;
  label: string;
  path: string;
  repository?: string;
  valid: boolean;
  validationMessage?: string;
};

export type SourceChangeReviewEntryState = {
  approved: boolean;
  digest: string;
  included: boolean;
};

export type SourceChangeReviewState = Readonly<Record<string, SourceChangeReviewEntryState>>;

export type SourceChangeReviewSummary = {
  approved: number;
  canApply: boolean;
  included: number;
  total: number;
};

export function reconcileSourceChangeReviewState(
  changes: readonly SourceChangeReviewItem[],
  current: SourceChangeReviewState = {},
): SourceChangeReviewState {
  const next = Object.fromEntries(changes.map((change) => {
    const previous = current[change.id];
    const sameDigest = previous?.digest === change.digest;
    return [change.id, {
      approved: Boolean(sameDigest && previous?.approved),
      digest: change.digest,
      included: previous?.included ?? change.defaultIncluded !== false,
    } satisfies SourceChangeReviewEntryState];
  }));
  return sameSourceChangeReviewState(current, next) ? current : next;
}

export function updateSourceChangeReviewEntry(
  state: SourceChangeReviewState,
  id: string,
  update: Partial<Pick<SourceChangeReviewEntryState, "approved" | "included">>,
): SourceChangeReviewState {
  const entry = state[id];
  if (!entry) return state;
  return { ...state, [id]: { ...entry, ...update } };
}

export function summarizeSourceChangeReview(
  changes: readonly SourceChangeReviewItem[],
  state: SourceChangeReviewState,
): SourceChangeReviewSummary {
  const entries = changes.map((change) => ({ change, state: state[change.id] }));
  const included = entries.filter((entry) => entry.state?.included);
  return {
    approved: entries.filter((entry) => entry.state?.approved).length,
    canApply: included.length > 0 && included.every((entry) => entry.change.valid && entry.state?.approved),
    included: included.length,
    total: changes.length,
  };
}

export function sameSourceChangeReviewState(left: SourceChangeReviewState, right: SourceChangeReviewState): boolean {
  const leftEntries = Object.entries(left);
  const rightEntries = Object.entries(right);
  return leftEntries.length === rightEntries.length && leftEntries.every(([id, entry]) => {
    const other = right[id];
    return other?.approved === entry.approved && other.digest === entry.digest && other.included === entry.included;
  });
}
