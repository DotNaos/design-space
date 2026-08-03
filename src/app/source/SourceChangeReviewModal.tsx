
import { lazy } from "react";

import { type SourceChangeReviewItem, type SourceChangeReviewState } from "./source-change-review";
import { OpenSourceChangeReviewModal } from "./OpenSourceChangeReviewModal";

export const MonacoSourceDiff = lazy(async () => {
  const module = await import("./MonacoSourceDiff");
  return { default: module.MonacoSourceDiff };
});

export type SourceChangeReviewModalProps = {
  applying?: boolean;
  changes: readonly SourceChangeReviewItem[];
  error?: string;
  initialState?: SourceChangeReviewState;
  open: boolean;
  onApply: (changes: readonly SourceChangeReviewItem[]) => void;
  onClose: () => void;
  onDiscard?: (id: string) => void;
  onReviewStateChange?: (state: SourceChangeReviewState) => void;
};

export function SourceChangeReviewModal(props: SourceChangeReviewModalProps) {
  return props.open ? <OpenSourceChangeReviewModal {...props} /> : null;
}
