import { Button, Tooltip } from "@heroui/react";

import type { SourceCodexOrigin } from "./source-codex-feedback-client";

type SourceCodexConnectionState = "checking" | "disconnected" | "ready";

export function SourceCodexConnectionIndicator(props: {
  connection: SourceCodexConnectionState;
  origin?: SourceCodexOrigin;
  onPress: () => void;
}) {
  const connected = props.connection === "ready" && Boolean(props.origin);
  const writable = connected && Boolean(props.origin?.writable);
  const label = props.connection === "checking"
    ? "Connecting…"
    : connected
      ? props.origin!.title
      : "Connect Codex";
  const accessibleLabel = props.connection === "checking"
    ? "Checking Codex connection"
    : connected
      ? `${writable ? "Connected to" : "Read-only Codex task"} ${props.origin!.title}. Change Codex task`
      : "Connect Codex task";
  const tone = props.connection === "checking"
    ? "border-white/8 bg-white/[0.03] text-zinc-500"
    : writable
      ? "border-emerald-300/20 bg-emerald-300/[0.09] text-emerald-200 hover:bg-emerald-300/[0.14]"
      : connected
        ? "border-amber-300/20 bg-amber-300/[0.08] text-amber-200 hover:bg-amber-300/[0.13]"
        : "border-rose-300/20 bg-rose-300/[0.07] text-rose-200 hover:bg-rose-300/[0.12]";
  const detail = props.connection === "checking"
    ? "Checking the current Codex task"
    : connected
      ? `${writable ? "Connected" : "Read only"} · ${props.origin!.title} · ${shortThreadId(props.origin!.threadId)}`
      : "No Codex task connected. Click to choose one.";

  return (
    <Tooltip closeDelay={80} delay={300}>
      <Button
        aria-label={accessibleLabel}
        className={`h-7 min-w-0 max-w-36 shrink-0 gap-1.5 rounded-full border px-2.5 text-[10px] font-medium ${tone}`}
        isDisabled={props.connection === "checking"}
        size="sm"
        variant="ghost"
        onPress={props.onPress}
      >
        <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current shadow-[0_0_7px_currentColor]" />
        <span className="truncate">{label}</span>
      </Button>
      <Tooltip.Content className="max-w-72 rounded-md border border-white/10 bg-[#202126] px-2 py-1 text-[10px] leading-4 text-zinc-200 shadow-xl">
        {detail}
      </Tooltip.Content>
    </Tooltip>
  );
}

function shortThreadId(threadId: string) {
  return `${threadId.slice(0, 8)}…${threadId.slice(-4)}`;
}
