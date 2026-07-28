import { Input, Label, ListBox, TextField } from "@heroui/react";
import { AlertCircle, Check, LoaderCircle, WandSparkles } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import type { TailwindCompletion, TailwindIntelligence } from "../../shared/contracts";
import { runLocalOperation } from "../api";

export function TailwindClassField(props: {
  value: string;
  previewValue?: string;
  label?: string;
  disabled?: boolean;
  compileError?: string;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const requestSequence = useRef(0);
  const blurTimer = useRef<number | undefined>(undefined);
  const listboxId = useId();
  const [cursor, setCursor] = useState(props.value.length);
  const [result, setResult] = useState<TailwindIntelligence>();
  const [activeIndex, setActiveIndex] = useState(0);
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const normalizedCursor = Math.min(cursor, props.value.length);
  const currentResult = result?.value === props.value && result.cursor === normalizedCursor ? result : undefined;
  const completions = currentResult?.completions.slice(0, 50) ?? [];
  const open = focused && completions.length > 0;
  const diagnostic = props.compileError ?? currentResult?.diagnostics[0]?.message;
  const previewDiff = props.previewValue && props.previewValue !== props.value
    ? classTokenDiff(props.value, props.previewValue)
    : undefined;

  const markFocused = () => {
    if (blurTimer.current !== undefined) window.clearTimeout(blurTimer.current);
    blurTimer.current = undefined;
    setFocused(true);
  };

  useEffect(() => () => {
    if (blurTimer.current !== undefined) window.clearTimeout(blurTimer.current);
  }, []);

  useEffect(() => {
    if (props.disabled || unavailable || !focused) return;
    const sequence = ++requestSequence.current;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const next = await runLocalOperation<TailwindIntelligence>({
          type: "analyze-tailwind",
          value: props.value,
          cursor: normalizedCursor,
        });
        if (sequence !== requestSequence.current) return;
        setResult(next);
        setActiveIndex(0);
      } catch {
        if (sequence === requestSequence.current) setUnavailable(true);
      } finally {
        if (sequence === requestSequence.current) setLoading(false);
      }
    }, 90);
    return () => window.clearTimeout(timer);
  }, [focused, normalizedCursor, props.disabled, props.value, unavailable]);

  const accept = (completion: TailwindCompletion | undefined) => {
    if (!completion || completion.replaceStart < 0 || completion.replaceEnd > props.value.length) return;
    const next = `${props.value.slice(0, completion.replaceStart)}${completion.insertText}${props.value.slice(completion.replaceEnd)}`;
    const nextCursor = completion.replaceStart + completion.insertText.length;
    props.onChange(next);
    setCursor(nextCursor);
    setResult(undefined);
    requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
      inputRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  return (
    <div className="relative">
      <TextField
        fullWidth
        isDisabled={props.disabled}
        value={props.value}
        onChange={(next) => {
          markFocused();
          setCursor(inputRef.current?.selectionStart ?? next.length);
          setUnavailable(false);
          props.onChange(next);
        }}
      >
        <span className="flex items-center justify-between gap-2 text-[10px] text-zinc-500">
          <Label>{props.label ?? "Tailwind classes"}</Label>
          <span className="flex items-center gap-1 text-[9px] text-zinc-700">
            {loading ? <LoaderCircle className="animate-spin" size={10} /> : unavailable ? <AlertCircle size={10} /> : result ? <Check size={10} /> : <WandSparkles size={10} />}
            {unavailable ? "Compile checks only" : "IntelliSense"}
          </span>
        </span>
        <div className="relative mt-1">
          <Input
            ref={inputRef}
            aria-autocomplete="list"
            aria-controls={open ? listboxId : undefined}
            aria-expanded={open}
            aria-label={props.label ?? "Tailwind classes"}
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            className={`min-h-11 w-full rounded-lg border bg-black/20 px-3 font-mono text-base outline-none lg:text-xs ${previewDiff ? "caret-transparent text-transparent" : "text-zinc-100"} ${diagnostic ? "border-rose-400/60 focus:border-rose-300" : "border-white/10 focus:border-sky-400"}`}
            role="combobox"
            spellCheck={false}
            onBlur={() => {
              blurTimer.current = window.setTimeout(() => {
                blurTimer.current = undefined;
                setFocused(false);
              }, 100);
            }}
            onClick={(event) => {
              markFocused();
              setCursor(event.currentTarget.selectionStart ?? props.value.length);
            }}
            onFocus={(event) => {
              markFocused();
              setCursor(event.currentTarget.selectionStart ?? props.value.length);
            }}
            onKeyDown={(event) => {
              if (!open) return;
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                const direction = event.key === "ArrowDown" ? 1 : -1;
                setActiveIndex((index) => (index + direction + completions.length) % completions.length);
              } else if (event.key === "Tab" || event.key === "Enter") {
                event.preventDefault();
                accept(completions[activeIndex]);
              } else if (event.key === "Escape") {
                event.preventDefault();
                setResult(undefined);
              }
            }}
            onSelect={(event) => setCursor(event.currentTarget.selectionStart ?? props.value.length)}
          />
          {previewDiff ? (
            <div
              aria-label={`${props.label ?? "Tailwind classes"} preview diff`}
              className="pointer-events-none absolute inset-0 flex items-center gap-1 overflow-hidden whitespace-nowrap rounded-lg px-3 font-mono text-base lg:text-xs"
              role="status"
            >
              {previewDiff.map((part, index) => (
                <span
                  key={`${part.kind}:${part.token}:${index}`}
                  className={part.kind === "removed"
                    ? "text-rose-300 line-through decoration-rose-400/80"
                    : part.kind === "added"
                      ? "text-emerald-300"
                      : "text-zinc-400"}
                >
                  {part.kind === "removed" ? "−" : part.kind === "added" ? "+" : ""}{part.token}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </TextField>

      {open && (
        <ListBox
          id={listboxId}
          aria-label="Tailwind suggestions"
          className="absolute inset-x-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-lg border border-white/10 bg-[#1a1b1e] p-1 shadow-2xl"
          selectedKeys={[String(activeIndex)]}
          selectionMode="single"
          onAction={(key) => accept(completions[Number(key)])}
        >
          {completions.map((completion, index) => (
            <ListBox.Item
              key={`${completion.label}:${completion.insertText}:${index}`}
              id={String(index)}
              className={`flex min-h-10 w-full items-center justify-start gap-2 rounded-md px-2 text-left ${index === activeIndex ? "bg-sky-500/10 text-sky-100" : "text-zinc-300 hover:bg-white/5"}`}
              textValue={completion.label}
            >
              <span className="min-w-0 flex-1 truncate font-mono text-xs">{completion.label}</span>
              {completion.detail && <span className="max-w-36 truncate text-[9px] text-zinc-600">{completion.detail}</span>}
            </ListBox.Item>
          ))}
        </ListBox>
      )}

      <p aria-live="polite" className={`mt-1 min-h-4 text-[9px] leading-4 ${diagnostic ? "text-rose-300" : "text-zinc-700"}`}>
        {diagnostic ?? (props.disabled ? "This target is read-only." : "Type a utility and press Tab to accept a suggestion.")}
      </p>
    </div>
  );
}

type ClassTokenDiffPart = {
  kind: "unchanged" | "removed" | "added";
  token: string;
};

function classTokenDiff(before: string, after: string): ClassTokenDiffPart[] {
  const previous = before.split(/\s+/).filter(Boolean);
  const next = after.split(/\s+/).filter(Boolean);
  const lengths = Array.from({ length: previous.length + 1 }, () => Array<number>(next.length + 1).fill(0));

  for (let previousIndex = previous.length - 1; previousIndex >= 0; previousIndex -= 1) {
    for (let nextIndex = next.length - 1; nextIndex >= 0; nextIndex -= 1) {
      lengths[previousIndex]![nextIndex] = previous[previousIndex] === next[nextIndex]
        ? lengths[previousIndex + 1]![nextIndex + 1]! + 1
        : Math.max(lengths[previousIndex + 1]![nextIndex]!, lengths[previousIndex]![nextIndex + 1]!);
    }
  }

  const parts: ClassTokenDiffPart[] = [];
  let previousIndex = 0;
  let nextIndex = 0;
  while (previousIndex < previous.length || nextIndex < next.length) {
    if (previous[previousIndex] === next[nextIndex]) {
      parts.push({ kind: "unchanged", token: previous[previousIndex]! });
      previousIndex += 1;
      nextIndex += 1;
    } else if (
      previousIndex < previous.length
      && (nextIndex >= next.length || lengths[previousIndex + 1]![nextIndex]! >= lengths[previousIndex]![nextIndex + 1]!)
    ) {
      parts.push({ kind: "removed", token: previous[previousIndex]! });
      previousIndex += 1;
    } else if (nextIndex < next.length) {
      parts.push({ kind: "added", token: next[nextIndex]! });
      nextIndex += 1;
    }
  }
  return parts;
}
