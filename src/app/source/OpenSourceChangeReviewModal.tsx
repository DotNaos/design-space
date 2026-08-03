import { Button, Modal } from "@heroui/react";
import { FileCode2, LoaderCircle, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { reconcileSourceChangeReviewState, sameSourceChangeReviewState, summarizeSourceChangeReview, updateSourceChangeReviewEntry, type SourceChangeReviewState } from "./source-change-review";
import { SourceChangeReviewModalProps } from "./SourceChangeReviewModal";
import { ChangeChecklist } from "./ChangeChecklist";
import { ChangeComparison } from "./ChangeComparison";

export function OpenSourceChangeReviewModal(props: SourceChangeReviewModalProps) {
  const [storedState, setStoredState] = useState<SourceChangeReviewState>(() => (
    reconcileSourceChangeReviewState(props.changes, props.initialState)
  ));
  const [activeId, setActiveId] = useState(props.changes[0]?.id);
  const onReviewStateChange = useRef(props.onReviewStateChange);
  const changeIdentity = props.changes.map((change) => (
    `${change.id}:${change.digest}:${change.valid}:${change.defaultIncluded !== false}`
  )).join("|");
  const reviewState = useMemo(
    () => reconcileSourceChangeReviewState(props.changes, storedState),
    [changeIdentity, storedState],
  );

  useEffect(() => {
    setStoredState((current) => {
      const next = reconcileSourceChangeReviewState(props.changes, {
        ...props.initialState,
        ...current,
      });
      return sameSourceChangeReviewState(current, next) ? current : next;
    });
  }, [changeIdentity, props.changes, props.initialState]);

  useEffect(() => {
    if (!sameSourceChangeReviewState(storedState, reviewState)) setStoredState(reviewState);
  }, [reviewState, storedState]);

  useEffect(() => {
    onReviewStateChange.current = props.onReviewStateChange;
  }, [props.onReviewStateChange]);

  useEffect(() => {
    onReviewStateChange.current?.(reviewState);
  }, [reviewState]);

  const activeChange = props.changes.find((change) => change.id === activeId) ?? props.changes[0];
  const summary = summarizeSourceChangeReview(props.changes, reviewState);
  const selectedChanges = props.changes.filter((change) => reviewState[change.id]?.included);

  function updateEntry(id: string, update: { approved?: boolean; included?: boolean }) {
    const next = updateSourceChangeReviewEntry(reviewState, id, update);
    onReviewStateChange.current?.(next);
    setStoredState(next);
  }

  return (
    <Modal.Backdrop
      isOpen={props.open}
      onOpenChange={(open) => { if (!open && !props.applying) props.onClose(); }}
      variant="blur"
    >
      <Modal.Container className="p-2 sm:p-5" placement="center" scroll="inside" size="cover">
        <Modal.Dialog
          aria-label="Review changes"
          className="h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-full overflow-hidden border border-white/10 bg-[#111214] text-zinc-200 sm:h-[calc(100dvh-2.5rem)] sm:max-h-[calc(100dvh-2.5rem)]"
        >
          <Modal.Header className="shrink-0 border-b border-white/10 px-4 py-3">
            <div className="flex w-full min-w-0 items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sky-500/10 text-sky-300">
                <FileCode2 aria-hidden="true" size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <Modal.Heading className="text-sm font-semibold text-zinc-100 sm:text-base">Review changes</Modal.Heading>
                <p aria-live="polite" className="mt-0.5 text-[10px] text-zinc-500">
                  {summary.approved} of {summary.total} approved · {summary.included} selected
                </p>
              </div>
              <Button
                aria-label="Close review"
                className="size-10 shrink-0"
                isDisabled={props.applying}
                isIconOnly
                size="sm"
                variant="ghost"
                onPress={props.onClose}
              >
                <X size={16} />
              </Button>
            </div>
          </Modal.Header>

          {props.error ? (
            <p className="shrink-0 border-b border-rose-400/20 bg-rose-400/[0.06] px-4 py-2 text-[10px] leading-4 text-rose-200" role="alert">
              {props.error}
            </p>
          ) : null}

          <Modal.Body className="min-h-0 flex-1 overflow-hidden p-0">
            {activeChange ? (
              <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[17rem_minmax(0,1fr)]">
                <ChangeChecklist
                  activeId={activeChange.id}
                  applying={Boolean(props.applying)}
                  changes={props.changes}
                  reviewState={reviewState}
                  onActivate={setActiveId}
                  onApprovalChange={(id, approved) => updateEntry(id, { approved })}
                  onInclusionChange={(id, included) => updateEntry(id, { included })}
                />
                <ChangeComparison applying={Boolean(props.applying)} change={activeChange} onDiscard={props.onDiscard} />
              </div>
            ) : (
              <div className="grid h-full place-items-center p-6 text-center">
                <div>
                  <FileCode2 aria-hidden="true" className="mx-auto text-zinc-700" size={24} />
                  <p className="mt-3 text-sm font-medium text-zinc-300">No cached changes</p>
                  <p className="mt-1 text-xs text-zinc-600">Keep editing to build a reviewable change set.</p>
                </div>
              </div>
            )}
          </Modal.Body>

          <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-white/10 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:flex-row sm:justify-end sm:px-4">
            <Button className="min-h-11 sm:min-h-9" isDisabled={props.applying} variant="secondary" onPress={props.onClose}>
              Keep editing
            </Button>
            <Button
              className="min-h-11 sm:min-h-9"
              isDisabled={!summary.canApply || props.applying}
              isPending={props.applying}
              onPress={() => props.onApply(selectedChanges)}
            >
              {props.applying ? <><LoaderCircle className="animate-spin" size={15} /> Applying…</> : `Apply selected (${summary.included})`}
            </Button>
          </footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
