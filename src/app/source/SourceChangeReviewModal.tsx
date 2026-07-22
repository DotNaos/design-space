import { Button, Checkbox, Label, Modal } from "@heroui/react";
import { CheckCircle2, CircleAlert, Diff, FileCode2, LoaderCircle, Trash2, X } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";

import {
  reconcileSourceChangeReviewState,
  sameSourceChangeReviewState,
  summarizeSourceChangeReview,
  updateSourceChangeReviewEntry,
  type SourceChangeReviewItem,
  type SourceChangeReviewState,
} from "./source-change-review";

const MonacoSourceDiff = lazy(async () => {
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

function OpenSourceChangeReviewModal(props: SourceChangeReviewModalProps) {
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

function ChangeChecklist(props: {
  activeId: string;
  applying: boolean;
  changes: readonly SourceChangeReviewItem[];
  reviewState: SourceChangeReviewState;
  onActivate: (id: string) => void;
  onApprovalChange: (id: string, approved: boolean) => void;
  onInclusionChange: (id: string, included: boolean) => void;
}) {
  return (
    <aside aria-label="Change approval checklist" className="min-h-0 overflow-y-auto border-b border-white/10 bg-[#141518] lg:border-b-0 lg:border-r">
      <div className="border-b border-white/[0.07] px-3 py-2">
        <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-zinc-600">Changed files</p>
        <p className="mt-1 text-[10px] text-zinc-500">Select what to apply, then approve each current version.</p>
      </div>
      <div className="max-h-48 divide-y divide-white/[0.05] lg:max-h-none">
        {props.changes.map((change) => {
          const state = props.reviewState[change.id];
          return (
            <div
              className={`grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 px-2 py-2 ${props.activeId === change.id ? "bg-sky-500/10" : "hover:bg-white/[0.025]"}`}
              key={change.id}
            >
              <Checkbox
                aria-label={`Include ${change.label}`}
                className="mt-0.5"
                isDisabled={props.applying}
                isSelected={state?.included}
                onChange={(included) => props.onInclusionChange(change.id, included)}
              >
                <Checkbox.Content>
                  <Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>
                </Checkbox.Content>
              </Checkbox>
              <Button
                aria-pressed={props.activeId === change.id}
                className="h-auto min-w-0 justify-start rounded-sm p-0 text-left"
                isDisabled={props.applying}
                variant="ghost"
                onPress={() => props.onActivate(change.id)}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-medium text-zinc-300">{change.label}</span>
                  <span className="mt-0.5 block truncate font-mono text-[9px] text-zinc-600">{change.path}</span>
                </span>
              </Button>
              <div className="col-start-2 mt-2 flex min-w-0 items-center gap-2">
                <Checkbox
                  aria-label={`Approve ${change.label}`}
                  isDisabled={props.applying || !state?.included || !change.valid}
                  isInvalid={!change.valid}
                  isSelected={state?.approved}
                  onChange={(approved) => props.onApprovalChange(change.id, approved)}
                >
                  <Checkbox.Content className="gap-1.5">
                    <Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>
                    <Label className="text-[10px] text-zinc-500">Approved</Label>
                  </Checkbox.Content>
                </Checkbox>
                {!change.valid && <span className="ml-auto flex items-center gap-1 text-[9px] text-amber-300"><CircleAlert size={11} /> Invalid</span>}
                {change.valid && state?.approved && <CheckCircle2 aria-label={`${change.label} approved`} className="ml-auto text-emerald-400" size={12} />}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function ChangeComparison(props: { applying: boolean; change: SourceChangeReviewItem; onDiscard?: (id: string) => void }) {
  return (
    <section aria-label={`${props.change.label} comparison`} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-2 border-b border-white/[0.07] px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium text-zinc-300">{props.change.label}</p>
          <p className="truncate font-mono text-[9px] text-zinc-600">{props.change.repository ? `${props.change.repository} · ` : ""}{props.change.path}</p>
        </div>
        {!props.change.valid && (
          <span className="flex shrink-0 items-center gap-1 text-[10px] text-amber-300"><CircleAlert size={12} /> Validation failed</span>
        )}
        {props.onDiscard && (
          <Button
            aria-label={`Discard ${props.change.label}`}
            isDisabled={props.applying}
            isIconOnly
            size="sm"
            variant="ghost"
            onPress={() => props.onDiscard?.(props.change.id)}
          >
            <Trash2 size={14} />
          </Button>
        )}
      </header>
      {props.change.validationMessage && (
        <p className="shrink-0 border-b border-amber-400/20 bg-amber-400/5 px-3 py-2 text-[10px] leading-4 text-amber-300" role="alert">
          {props.change.validationMessage}
        </p>
      )}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 sm:p-4">
        <div className="grid shrink-0 grid-cols-1 gap-3 xl:grid-cols-2" data-testid="source-change-comparison-grid">
          <PreviewSide label="Before" preview={props.change.before.preview} />
          <PreviewSide label="After" preview={props.change.after.preview} />
        </div>
        <SourceDiff change={props.change} />
      </div>
    </section>
  );
}

function PreviewSide(props: { label: "After" | "Before"; preview: React.ReactNode }) {
  return (
    <section aria-label={`${props.label} change`} className="min-w-0 overflow-hidden rounded-md border border-white/[0.08] bg-[#0d0e10]">
      <h3 className="border-b border-white/[0.07] px-3 py-2 text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-500">{props.label}</h3>
      <div aria-label={`${props.label} preview`} className="grid h-52 place-items-center overflow-auto bg-[#101113] p-4" role="region">
        {props.preview}
      </div>
    </section>
  );
}

function SourceDiff(props: { change: SourceChangeReviewItem }) {
  return (
    <section aria-label="Source diff" className="min-h-[22rem] flex-1 overflow-hidden rounded-md border border-white/[0.08] bg-[#0d0e10]">
      <header className="flex h-9 items-center gap-2 border-b border-white/[0.07] px-3">
        <Diff aria-hidden="true" className="text-sky-300" size={13} />
        <h3 className="text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-500">Source diff</h3>
        <span className="ml-auto text-[9px] text-zinc-600">Synchronized scroll</span>
      </header>
      <div className="h-[calc(100%-2.25rem)] min-h-0">
        <Suspense fallback={<div className="grid h-full place-items-center text-[10px] text-zinc-600"><LoaderCircle className="animate-spin" size={14} /> Loading highlighted diff…</div>}>
          <MonacoSourceDiff
            key={props.change.id}
            modified={props.change.after.source}
            original={props.change.before.source}
            path={props.change.path}
          />
        </Suspense>
      </div>
    </section>
  );
}
