
import { Shield, ShieldCheck, ShieldX } from "lucide-react";
import type { StrictUiEvidence } from "../../shared/strict-ui";
import { RailButton } from "./RailButton";

export function StrictRailButton(props: {
  strictUi?: StrictUiEvidence;
  strictUiChecking: boolean;
  canStrictUi: boolean;
  onStrictUi: () => void;
}) {
  const label = props.strictUiChecking ? "Strict UI checking" : props.strictUi ? `Strict UI ${props.strictUi.status}` : "Strict UI not checked";
  const Icon = props.strictUi?.status === "passed" ? ShieldCheck : props.strictUi?.status === "blocked" ? ShieldX : Shield;
  const tone = props.strictUi?.status === "passed" ? "text-emerald-400" : props.strictUi?.status === "blocked" ? "text-rose-400" : props.strictUi?.status === "warnings" ? "text-amber-400" : undefined;
  return <RailButton label={label} disabled={!props.canStrictUi} onPress={props.onStrictUi}><Icon className={tone} size={18} /></RailButton>;
}
