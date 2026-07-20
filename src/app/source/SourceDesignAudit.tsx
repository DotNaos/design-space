import { Button, Popover, SearchField } from "@heroui/react";
import { Check, FileCode2, FileWarning, ListChecks, Monitor, Smartphone, Tablet } from "lucide-react";
import { useMemo, useState } from "react";

import type { DesignSpaceDevice, RuntimeSourceWorkspace, RuntimeSourceWorkspaceEntry } from "../../shared/source-workspace";

export function SourceDesignAudit(props: {
  workspace: RuntimeSourceWorkspace;
  onSelect: (entry: RuntimeSourceWorkspaceEntry) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const entries = useMemo(() => [...props.workspace.entries].sort(compareEntries), [props.workspace.entries]);
  const filtered = useMemo(() => entries.filter((entry) => matches(entry, query)), [entries, query]);
  const missing = filtered.filter((entry) => !entry.design);
  const ready = filtered.filter((entry) => entry.design);
  const totalMissing = entries.filter((entry) => !entry.design).length;
  const totalReady = entries.length - totalMissing;
  const select = (entry: RuntimeSourceWorkspaceEntry) => {
    props.onSelect(entry);
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover isOpen={open} onOpenChange={(next) => {
      setOpen(next);
      if (!next) setQuery("");
    }}>
      <Button
        aria-label={`Open design file audit, ${totalMissing} missing of ${entries.length}`}
        className="relative grid size-8 place-items-center rounded-md text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-200"
        isIconOnly
        size="sm"
        variant="ghost"
      >
        <ListChecks aria-hidden="true" size={14} />
        {totalMissing > 0 && <span aria-hidden="true" className="absolute right-1 top-1 size-1.5 rounded-full bg-amber-400" />}
      </Button>
      <Popover.Content
        className="w-[min(28rem,calc(100vw-1rem))] overflow-hidden rounded-xl border border-white/10 bg-[#1a1b1f] p-0 text-zinc-200 shadow-2xl"
        placement="bottom end"
      >
        <Popover.Dialog className="outline-none">
          <header className="border-b border-white/10 px-3.5 py-3">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <Popover.Heading className="text-xs font-semibold text-zinc-100">Design file audit</Popover.Heading>
                <p className="mt-0.5 text-[9px] text-zinc-600">Every indexed component export needs colocated design evidence.</p>
              </div>
              <p className="shrink-0 text-[9px] tabular-nums text-zinc-500">
                <span className="text-emerald-400">{totalReady} ready</span>
                <span aria-hidden="true" className="px-1.5 text-zinc-700">·</span>
                <span className={totalMissing ? "text-amber-300" : "text-zinc-500"}>{totalMissing} missing</span>
              </p>
            </div>
            <SearchField aria-label="Search design file audit" className="mt-3" fullWidth value={query} onChange={setQuery}>
              <SearchField.Group className="flex h-8 items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2.5 text-zinc-500 focus-within:border-sky-400/50">
                <SearchField.SearchIcon className="size-3.5" />
                <SearchField.Input autoFocus className="min-w-0 flex-1 bg-transparent text-[10px] text-zinc-200 outline-none placeholder:text-zinc-700" placeholder="Search component or source path" />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
          </header>
          <div className="max-h-[min(34rem,65vh)] overflow-y-auto py-1.5">
            <AuditSection entries={missing} status="missing" onSelect={select} />
            <AuditSection entries={ready} status="ready" onSelect={select} />
            {!filtered.length && <p className="px-4 py-10 text-center text-[10px] text-zinc-600">No matching component exports.</p>}
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

function AuditSection(props: {
  entries: readonly RuntimeSourceWorkspaceEntry[];
  status: "missing" | "ready";
  onSelect: (entry: RuntimeSourceWorkspaceEntry) => void;
}) {
  if (!props.entries.length) return null;
  return (
    <section aria-label={`${props.status === "missing" ? "Missing" : "Ready"} design files`}>
      <div className="flex h-7 items-center px-3.5 text-[8px] font-medium uppercase tracking-[0.14em] text-zinc-600">
        <span className="flex-1">{props.status === "missing" ? "Missing" : "Ready"}</span>
        <span className="tabular-nums">{props.entries.length}</span>
      </div>
      {props.entries.map((entry) => <AuditRow key={entry.id} entry={entry} onSelect={props.onSelect} />)}
    </section>
  );
}

function AuditRow(props: {
  entry: RuntimeSourceWorkspaceEntry;
  onSelect: (entry: RuntimeSourceWorkspaceEntry) => void;
}) {
  const DeviceIcon = deviceIcon(props.entry.device);
  const ready = Boolean(props.entry.design);
  return (
    <Button
      aria-label={`Open ${props.entry.label} source, design ${ready ? "ready" : "missing"}`}
      className="min-h-11 w-full justify-start gap-2 rounded-none px-3.5 text-left text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100"
      fullWidth
      size="sm"
      variant="ghost"
      onPress={() => props.onSelect(props.entry)}
    >
      <FileCode2 aria-hidden="true" className="shrink-0 text-zinc-600" size={13} />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[10px] font-medium">{props.entry.label}</span>
          <DeviceIcon aria-hidden="true" className="shrink-0 text-zinc-700" size={10} />
        </span>
        <span className="block truncate font-mono text-[8px] text-zinc-700">{props.entry.relativePath}</span>
      </span>
      {ready
        ? <Check aria-label="Design ready" className="shrink-0 text-emerald-400" size={12} />
        : <FileWarning aria-label="Design missing" className="shrink-0 text-amber-300" size={12} />}
      <span className="sr-only">{props.entry.design?.relativePath ?? "No design file"}</span>
    </Button>
  );
}

function matches(entry: RuntimeSourceWorkspaceEntry, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  return [entry.label, entry.exportName, entry.relativePath, entry.design?.relativePath]
    .some((value) => value?.toLocaleLowerCase().includes(needle));
}

function compareEntries(left: RuntimeSourceWorkspaceEntry, right: RuntimeSourceWorkspaceEntry): number {
  return Number(Boolean(left.design)) - Number(Boolean(right.design))
    || left.label.localeCompare(right.label, "en")
    || left.device.localeCompare(right.device, "en")
    || left.relativePath.localeCompare(right.relativePath, "en");
}

function deviceIcon(device: DesignSpaceDevice) {
  if (device === "mobile") return Smartphone;
  if (device === "tablet") return Tablet;
  return Monitor;
}
