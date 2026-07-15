import { Button, Modal } from "@heroui/react";
import { AlertTriangle, CheckCircle2, ChevronRight, Info, ShieldCheck, X } from "lucide-react";
import { useEffect } from "react";

import type { StrictUiEvidence, StrictUiViolation } from "../../shared/strict-ui";

export function StrictUiSheet(props: {
  open: boolean;
  evidence?: StrictUiEvidence;
  liveViolations: readonly StrictUiViolation[];
  checking: boolean;
  onClose: () => void;
  onSelect: (violation: StrictUiViolation) => void;
  onRecheck: () => void;
}) {
  useEffect(() => {
    if (!props.open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      props.onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [props.open, props.onClose]);

  if (!props.open) return null;
  const violations = props.evidence?.violations ?? props.liveViolations;
  const current = Boolean(props.evidence) && !props.checking;
  return (
    <Modal.Backdrop
      isOpen
      variant="blur"
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <Modal.Container className="items-end justify-end p-0 lg:items-stretch" placement="bottom" size="full">
        <Modal.Dialog
          aria-labelledby="strict-ui-heading"
          className="flex max-h-[88dvh] w-full flex-col rounded-b-none rounded-t-3xl border border-white/10 bg-[#141518] text-zinc-200 shadow-2xl lg:ml-auto lg:h-full lg:max-h-none lg:w-[26rem] lg:rounded-none"
        >
          <Modal.Header className="flex min-h-14 items-center gap-3 border-b border-white/10 px-4">
            <ShieldCheck
              className={props.evidence?.status === "blocked" ? "text-rose-400" : "text-emerald-400"}
              size={18}
            />
            <div className="min-w-0 flex-1">
              <Modal.Heading id="strict-ui-heading" className="text-sm font-semibold text-zinc-100">
                Strict UI
              </Modal.Heading>
              <p className="text-[10px] text-zinc-600">
                {props.checking
                  ? "Checking current document…"
                  : current
                    ? "Server-verified for this revision"
                    : "Live findings · run Diff to verify"}
              </p>
            </div>
            <Button aria-label="Close Strict UI" isIconOnly size="sm" variant="ghost" onPress={props.onClose}>
              <X size={15} />
            </Button>
          </Modal.Header>
          <Modal.Body className="min-h-0 flex-1 overflow-y-auto p-0">
            {!violations.length && (
              <div className="grid min-h-48 place-items-center px-6 text-center">
                <div>
                  <CheckCircle2 className="mx-auto text-emerald-400" size={28} />
                  <p className="mt-3 text-sm text-zinc-200">No Strict UI findings</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-600">
                    The current structure follows the registered component and slot rules.
                  </p>
                </div>
              </div>
            )}
            {violations.map((violation, index) => (
              <Button
                key={`${violation.ruleId}-${index}`}
                className="flex min-h-16 w-full items-start justify-start gap-3 rounded-none border-b border-white/5 px-4 py-3 text-left hover:bg-white/[0.03]"
                variant="ghost"
                onPress={() => props.onSelect(violation)}
              >
                {violation.severity === "error" ? (
                  <AlertTriangle className="mt-0.5 shrink-0 text-rose-400" size={15} />
                ) : violation.severity === "warning" ? (
                  <AlertTriangle className="mt-0.5 shrink-0 text-amber-400" size={15} />
                ) : (
                  <Info className="mt-0.5 shrink-0 text-sky-400" size={15} />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-zinc-200">{violation.message}</span>
                  <span className="mt-1 block text-[9px] text-zinc-600">{violation.ruleId}</span>
                </span>
                <ChevronRight className="mt-1 text-zinc-700" size={13} />
              </Button>
            ))}
          </Modal.Body>
          <Modal.Footer className="border-t border-white/10 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <Button className="w-full" isDisabled={props.checking} onPress={props.onRecheck}>
              {props.checking ? "Checking…" : "Check current document"}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
