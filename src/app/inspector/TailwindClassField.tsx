import { AlertCircle, Check, LoaderCircle, WandSparkles } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import type { TailwindCompletion, TailwindIntelligence } from "../../shared/contracts";
import { runLocalOperation } from "../api";

export function TailwindClassField(props: {
  value: string;
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
      <label className="block">
        <span className="flex items-center justify-between gap-2 text-[10px] text-zinc-500">
          <span>{props.label ?? "Tailwind classes"}</span>
          <span className="flex items-center gap-1 text-[9px] text-zinc-700">
            {loading ? <LoaderCircle className="animate-spin" size={10} /> : unavailable ? <AlertCircle size={10} /> : result ? <Check size={10} /> : <WandSparkles size={10} />}
            {unavailable ? "Compile checks only" : "IntelliSense"}
          </span>
        </span>
        <input
          ref={inputRef}
          aria-autocomplete="list"
          aria-controls={open ? listboxId : undefined}
          aria-expanded={open}
          aria-label={props.label ?? "Tailwind classes"}
          aria-activedescendant={open ? `${listboxId}-${activeIndex}` : undefined}
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect="off"
          className={`mt-1 min-h-11 w-full rounded-lg border bg-black/20 px-3 font-mono text-base text-zinc-100 outline-none lg:text-xs ${diagnostic ? "border-rose-400/60 focus:border-rose-300" : "border-white/10 focus:border-sky-400"}`}
          disabled={props.disabled}
          role="combobox"
          spellCheck={false}
          value={props.value}
          onBlur={() => {
            blurTimer.current = window.setTimeout(() => {
              blurTimer.current = undefined;
              setFocused(false);
            }, 100);
          }}
          onChange={(event) => {
            markFocused();
            setCursor(event.currentTarget.selectionStart ?? event.currentTarget.value.length);
            setUnavailable(false);
            props.onChange(event.currentTarget.value);
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
      </label>

      {open && (
        <div id={listboxId} aria-label="Tailwind suggestions" className="absolute inset-x-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-lg border border-white/10 bg-[#1a1b1e] p-1 shadow-2xl" role="listbox">
          {completions.map((completion, index) => (
            <button
              key={`${completion.label}:${completion.insertText}:${index}`}
              id={`${listboxId}-${index}`}
              aria-selected={index === activeIndex}
              className={`flex min-h-10 w-full items-center gap-2 rounded-md px-2 text-left ${index === activeIndex ? "bg-sky-500/10 text-sky-100" : "text-zinc-300 hover:bg-white/5"}`}
              role="option"
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => accept(completion)}
            >
              <span className="min-w-0 flex-1 truncate font-mono text-xs">{completion.label}</span>
              {completion.detail && <span className="max-w-36 truncate text-[9px] text-zinc-600">{completion.detail}</span>}
            </button>
          ))}
        </div>
      )}

      <p aria-live="polite" className={`mt-1 min-h-4 text-[9px] leading-4 ${diagnostic ? "text-rose-300" : "text-zinc-700"}`}>
        {diagnostic ?? (props.disabled ? "This target is read-only." : "Type a utility and press Tab to accept a suggestion.")}
      </p>
    </div>
  );
}
