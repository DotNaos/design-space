import { Button, Popover, SearchField } from "@heroui/react";
import { Check, ChevronDown, Component, Eye, Plus, Replace, SearchX } from "lucide-react";
import { useMemo, useState } from "react";

import type { SourceWorkspaceLayer } from "../../shared/source-workspace";
import {
  filterSourceSlotCandidates,
  type SourceComponentCandidate,
} from "./source-slot-composition";

export function SourceComponentPicker(props: {
  candidates: readonly SourceComponentCandidate[];
  slot: SourceWorkspaceLayer;
  triggerId?: string;
  onApply: (candidate: SourceComponentCandidate, action: "add" | "replace") => void;
}) {
  const usage = props.slot.slot;
  const action = usage?.contract.multiple || !usage?.received.length ? "add" : "replace";
  const full = Boolean(action === "add" && usage?.contract.max !== undefined && usage.received.length >= usage.contract.max);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [revealIncompatible, setRevealIncompatible] = useState(false);
  const [active, setActive] = useState(0);
  const candidates = useMemo(
    () => filterSourceSlotCandidates(props.candidates, query, revealIncompatible),
    [props.candidates, query, revealIncompatible],
  );
  const apply = (candidate: SourceComponentCandidate) => {
    if (!candidate.insertable) return;
    props.onApply(candidate, action);
    setOpen(false);
    setQuery("");
  };
  return (
    <Popover isOpen={open} onOpenChange={(next) => {
      if (full) return;
      setOpen(next);
      if (next) setActive(0);
    }}>
      <Button
        id={props.triggerId}
        aria-label={full
          ? `${props.slot.label} slot is full, ${usage?.received.length} of ${usage?.contract.max}`
          : `${action === "add" ? "Add to" : "Replace content in"} ${props.slot.label} slot`}
        className="h-7 min-w-0 shrink-0 gap-1 rounded-md px-2 text-[9px] text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200"
        isDisabled={full}
        size="sm"
        variant="ghost"
      >
        {action === "add" ? <Plus aria-hidden="true" size={11} /> : <Replace aria-hidden="true" size={11} />}
        {action === "add" ? "Add" : "Replace"}
        <ChevronDown aria-hidden="true" size={10} />
      </Button>
      <Popover.Content className="w-[min(22rem,calc(100vw-1rem))] rounded-xl border border-white/10 bg-[#1a1b1f] p-0 text-zinc-200 shadow-2xl" placement="bottom start">
        <Popover.Dialog className="outline-none">
          <div className="border-b border-white/10 p-3">
            <Popover.Heading className="text-xs font-semibold text-zinc-100">
              {action === "add" ? `Add to ${props.slot.label}` : `Replace ${props.slot.label}`}
            </Popover.Heading>
            <p className="mt-1 text-[9px] text-zinc-600">Accepts {usage?.contract.accepts.join(", ")}</p>
            <SearchField aria-label="Search compatible components" className="mt-3" fullWidth value={query} onChange={(value) => {
              setQuery(value);
              setActive(0);
            }}>
              <SearchField.Group className="flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-2.5 text-zinc-500 focus-within:border-sky-400/50">
                <SearchField.SearchIcon className="size-3.5" />
                <SearchField.Input
                  autoFocus
                  autoComplete="off"
                  className="min-w-0 flex-1 bg-transparent text-xs text-zinc-200 outline-none placeholder:text-zinc-700"
                  placeholder="Search name, group, or source"
                  role="combobox"
                  aria-controls="source-compatible-components"
                  aria-expanded="true"
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      setActive((value) => Math.min(candidates.length - 1, value + 1));
                    } else if (event.key === "ArrowUp") {
                      event.preventDefault();
                      setActive((value) => Math.max(0, value - 1));
                    } else if (event.key === "Enter" && candidates[active]) {
                      event.preventDefault();
                      apply(candidates[active]);
                    } else if (event.key === "Escape") {
                      setOpen(false);
                    }
                  }}
                />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
          </div>
          <div id="source-compatible-components" className="max-h-72 overflow-y-auto p-1.5" role="listbox" aria-label="Compatible components">
            {candidates.map((candidate, index) => {
              const current = usage?.received.includes(candidate.name);
              return (
                <Button
                  key={candidate.id}
                  aria-label={`${candidate.name}, ${candidate.compatible ? "compatible" : "incompatible"}`}
                  className={`min-h-12 w-full justify-start gap-2.5 rounded-lg px-2 text-left ${index === active ? "bg-sky-400/10 text-sky-100" : "text-zinc-300 hover:bg-white/[0.05]"}`}
                  fullWidth
                  isDisabled={!candidate.insertable}
                  variant="ghost"
                  onHoverStart={() => setActive(index)}
                  onPress={() => apply(candidate)}
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-md bg-white/[0.04] text-zinc-500"><Component aria-hidden="true" size={14} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-xs font-medium">
                      <span className="truncate">{candidate.name}</span>
                      {current && <Check aria-label="Currently used" className="shrink-0 text-emerald-400" size={12} />}
                    </span>
                    <span className="block truncate text-[9px] text-zinc-600">{candidate.group} · {candidate.source}</span>
                    {candidate.explanation && <span className="block truncate text-[9px] text-amber-300/70">{candidate.explanation}</span>}
                  </span>
                  {candidate.deviceState !== "available" && <span className="text-[8px] uppercase text-zinc-600">{candidate.deviceState}</span>}
                </Button>
              );
            })}
            {!candidates.length && (
              <div className="px-4 py-8 text-center">
                <SearchX aria-hidden="true" className="mx-auto text-zinc-700" size={18} />
                <p className="mt-2 text-xs text-zinc-400">No matching compatible component.</p>
                <p className="mt-1 text-[9px] leading-4 text-zinc-600">This slot accepts {usage?.contract.accepts.join(", ")}.</p>
              </div>
            )}
          </div>
          <div className="flex items-center border-t border-white/10 p-2">
            <Button
              className={`h-7 gap-1.5 rounded-md px-2 text-[9px] ${revealIncompatible ? "text-amber-200" : "text-zinc-600"}`}
              size="sm"
              variant="ghost"
              onPress={() => setRevealIncompatible((value) => !value)}
            >
              <Eye aria-hidden="true" size={11} />
              {revealIncompatible ? "Hide incompatible" : "Explain incompatible"}
            </Button>
            <span className="ml-auto text-[8px] text-zinc-700">↑↓ Navigate · Enter apply · Esc close</span>
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
