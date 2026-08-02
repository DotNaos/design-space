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
    ? "text-zinc-500"
    : writable
      ? "text-emerald-200 hover:bg-emerald-300/[0.08]"
      : connected
        ? "text-amber-200 hover:bg-amber-300/[0.08]"
        : "text-rose-200 hover:bg-rose-300/[0.08]";
  const detail = props.connection === "checking"
    ? "Checking the current Codex task"
    : connected
      ? `${writable ? "Connected" : "Read only"} · ${props.origin!.title} · ${shortThreadId(props.origin!.threadId)}`
      : "No Codex task connected. Click to choose one.";

  return (
    <Tooltip closeDelay={80} delay={300}>
      <Button
        aria-label={accessibleLabel}
        className={`h-6 min-w-0 max-w-32 shrink-0 gap-1.5 rounded-md px-1.5 text-[9px] font-medium ${tone}`}
        isDisabled={props.connection === "checking"}
        size="sm"
        variant="ghost"
        onPress={props.onPress}
      >
        <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
        <span className="truncate">{label}</span>
      </Button>
      <Tooltip.Content className="max-w-72 rounded-lg bg-[#202126] px-2 py-1 text-[10px] leading-4 text-zinc-200 shadow-xl">
        {detail}
      </Tooltip.Content>
    </Tooltip>
  );
}

function shortThreadId(threadId: string) {
  return `${threadId.slice(0, 8)}…${threadId.slice(-4)}`;
}
