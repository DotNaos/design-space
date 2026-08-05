import { Button } from "@heroui/react";
import { AlertTriangle, CheckCircle2, LoaderCircle, Shield } from "lucide-react";
import type { StrictUiEvidence } from "../../shared/strict-ui";

export function StrictStatusButton(props: { disabled: boolean; evidence?: StrictUiEvidence; checking: boolean; onPress: () => void }) {
  const label = props.checking ? "Strict UI checking" : props.evidence ? `Strict UI ${props.evidence.status}` : "Strict UI not checked";
  const icon = props.checking
    ? <LoaderCircle className="animate-spin" size={14} />
    : props.evidence?.status === "passed"
      ? <CheckCircle2 size={14} />
      : props.evidence?.status === "blocked" || props.evidence?.status === "warnings"
        ? <AlertTriangle size={14} />
        : <Shield size={14} />;
  const tone = props.evidence?.status === "passed" ? "text-emerald-400" : props.evidence?.status === "blocked" ? "text-rose-400" : props.evidence?.status === "warnings" ? "text-amber-400" : "text-zinc-600";
  return <Button aria-label={label} className={`size-9 shrink-0 ${tone}`} isDisabled={props.disabled} isIconOnly size="sm" variant="ghost" onPress={props.onPress}>{icon}</Button>;
}
