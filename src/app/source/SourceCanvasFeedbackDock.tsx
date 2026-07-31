import { Button, Input, Tooltip } from "@heroui/react";
import { Cable, Maximize2, MessageSquarePlus, Send, Unplug } from "lucide-react";
import { useEffect, useState } from "react";

import { SourceCodexChatModal } from "./SourceCodexChatModal";
import { SourceCodexConnectionModal } from "./SourceCodexConnectionModal";
import {
  addSourceFeedbackAnnotation,
  formatSourceFeedback,
  type SourceFeedbackContext,
  useSourceFeedbackAnnotations,
} from "./source-feedback";
import {
  inspectSourceCodexOrigin,
  requestedSourceCodexThreadId,
  sendSourceCodexFeedback,
  SourceCodexTaskUnavailableError,
  type SourceCodexOrigin,
} from "./source-codex-feedback-client";

export function SourceCanvasFeedbackDock(props: {
  context?: SourceFeedbackContext;
}) {
  const [draft, setDraft] = useState("");
  const [origin, setOrigin] = useState<SourceCodexOrigin>();
  const [preferredThreadId, setPreferredThreadId] = useState(requestedSourceCodexThreadId);
  const [connection, setConnection] = useState<"checking" | "disconnected" | "ready">("checking");
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [conversationOpen, setConversationOpen] = useState(false);
  const [connectionNotice, setConnectionNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);
  const comments = useSourceFeedbackAnnotations(props.context?.id);

  useEffect(() => {
    let active = true;
    void inspectSourceCodexOrigin()
      .then((next) => {
        if (!active) return;
        setOrigin(next);
        setConnection(next ? "ready" : "disconnected");
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setConnection("disconnected");
        if (cause instanceof SourceCodexTaskUnavailableError) {
          setPreferredThreadId(cause.threadId ?? requestedSourceCodexThreadId());
          setConnectionNotice(cause.message);
          setConnectionOpen(true);
          return;
        }
        setError(cause instanceof Error ? cause.message : "The Codex task is not reachable.");
      });
    return () => { active = false; };
  }, []);

  async function send() {
    if (!origin || !draft.trim() || sending) return;
    setSending(true);
    setError(undefined);
    try {
      await sendSourceCodexFeedback(origin, formatSourceFeedback(draft, props.context));
      if (props.context) addSourceFeedbackAnnotation(draft, props.context);
      setDraft("");
    } catch (cause: unknown) {
      if (cause instanceof SourceCodexTaskUnavailableError) {
        setOrigin(undefined);
        setPreferredThreadId(cause.threadId ?? origin.threadId);
        setConnection("disconnected");
        setConnectionNotice(cause.message);
        setConnectionOpen(true);
      } else {
        setError(cause instanceof Error ? cause.message : "Feedback could not be sent.");
      }
    } finally {
      setSending(false);
    }
  }

  const connected = connection === "ready" && Boolean(origin);
  const writable = connected && Boolean(origin?.writable);
  const placeholder = connection === "checking"
    ? "Connecting to Codex…"
      : writable
      ? props.context
        ? `Comment on ${props.context.label}…`
        : "Message the working Codex task…"
      : connected
        ? "Reconnect this Codex task to send…"
      : "Choose a Codex task to connect…";

  return (
    <>
      <div
        aria-label="Codex composer"
        className={`relative flex h-9 min-w-64 max-w-[min(520px,48vw)] flex-1 items-center rounded-lg border bg-[#18191d]/95 shadow-xl shadow-black/30 backdrop-blur ${
          writable ? "border-white/10" : "border-amber-300/15"
        }`}
      >
        {error ? (
          <div
            role="alert"
            className="absolute bottom-full right-0 mb-2 max-w-[min(420px,calc(100vw-2rem))] rounded-md border border-red-400/25 bg-[#26171a] px-2 py-1 text-[9px] leading-4 text-red-200 shadow-xl"
          >
            {error}
          </div>
        ) : null}
        <Tooltip closeDelay={80} delay={350}>
          <Button
            isIconOnly
            aria-label="Open full Codex conversation"
            className="size-7 min-w-7 shrink-0 text-zinc-500 hover:text-zinc-300"
            isDisabled={!connected}
            size="sm"
            variant="ghost"
            onPress={() => setConversationOpen(true)}
          >
            <Maximize2 aria-hidden="true" size={12} />
          </Button>
          <Tooltip.Content className="rounded-md border border-white/10 bg-[#202126] px-2 py-1 text-[10px] text-zinc-200 shadow-xl">
            Open full conversation
          </Tooltip.Content>
        </Tooltip>
        <Tooltip closeDelay={80} delay={350}>
          <Button
            isIconOnly
            aria-label={props.context ? `${comments.length} comments on ${props.context.label}` : "No layer selected"}
            className="size-7 min-w-7 text-zinc-500"
            isDisabled={!props.context}
            size="sm"
            variant="ghost"
          >
            <MessageSquarePlus aria-hidden="true" size={13} />
            {comments.length ? (
              <span className="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-violet-400" />
            ) : null}
          </Button>
          <Tooltip.Content className="rounded-md border border-white/10 bg-[#202126] px-2 py-1 text-[10px] text-zinc-200 shadow-xl">
            {props.context ? `${comments.length} saved comment${comments.length === 1 ? "" : "s"}` : "Select a component or layer"}
          </Tooltip.Content>
        </Tooltip>
        <Input
          aria-label="Codex feedback"
          className={`min-w-0 flex-1 bg-transparent px-1 text-[11px] text-zinc-200 outline-none placeholder:text-zinc-600 ${
            writable ? "" : "cursor-pointer"
          }`}
          placeholder={placeholder}
          readOnly={!writable}
          disabled={sending}
          value={draft}
          onClick={() => {
            if (!writable && connection !== "checking") setConnectionOpen(true);
          }}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
        />
        <Tooltip closeDelay={80} delay={350}>
          <Button
            isIconOnly
            aria-label={connected ? "Change connected Codex task" : "Connect Codex task"}
            className={`size-7 min-w-7 shrink-0 ${
              writable ? "text-zinc-500 hover:text-zinc-300" : "text-amber-300/70 hover:bg-amber-300/10"
            }`}
            isDisabled={connection === "checking"}
            size="sm"
            variant="ghost"
            onPress={() => setConnectionOpen(true)}
          >
            {writable ? <Cable aria-hidden="true" size={12} /> : <Unplug aria-hidden="true" size={12} />}
          </Button>
          <Tooltip.Content className="max-w-64 rounded-md border border-white/10 bg-[#202126] px-2 py-1 text-[10px] leading-4 text-zinc-200 shadow-xl">
            {writable
              ? `Connected to ${origin?.title}. Click to change task.`
              : connected
                ? `${origin?.title} needs to be reconnected before sending messages.`
                : "Choose an existing Codex task or create a new one."}
          </Tooltip.Content>
        </Tooltip>
        <Tooltip closeDelay={80} delay={350}>
          <Button
            isIconOnly
            aria-label="Send to Codex"
            className="size-7 min-w-7 rounded-md text-sky-300 hover:bg-sky-400/10"
            isDisabled={!writable || !draft.trim()}
            isPending={sending}
            size="sm"
            variant="ghost"
            onPress={() => void send()}
          >
            <Send aria-hidden="true" size={12} />
          </Button>
          <Tooltip.Content className="rounded-md border border-white/10 bg-[#202126] px-2 py-1 text-[10px] text-zinc-200 shadow-xl">
            {writable ? `Send to ${origin?.title}` : "Reconnect a Codex task to send"}
          </Tooltip.Content>
        </Tooltip>
      </div>
      <SourceCodexConnectionModal
        current={origin}
        preferredThreadId={preferredThreadId}
        notice={connectionNotice}
        open={connectionOpen}
        onClose={() => {
          setConnectionOpen(false);
          setConnectionNotice(undefined);
        }}
        onConnected={(task) => {
          setOrigin(task);
          setPreferredThreadId(task.threadId);
          setConnection("ready");
          setConnectionNotice(undefined);
          setError(undefined);
        }}
      />
      <SourceCodexChatModal
        context={props.context}
        open={conversationOpen}
        origin={origin}
        onChooseTask={() => {
          setConversationOpen(false);
          setConnectionOpen(true);
        }}
        onClose={() => setConversationOpen(false)}
      />
    </>
  );
}
