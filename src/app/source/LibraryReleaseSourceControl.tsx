import { Input, ListBox, Select } from "@heroui/react";
import { LoaderCircle, PackageCheck, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { LibraryReleaseStatus } from "../../shared/source-workspace";
import { runLocalOperation } from "../api";
import { LibraryReleaseVersionItem } from "./LibraryReleaseVersionItem";

interface LibraryReleaseSourceControlProps {
  active: boolean;
  fallbackVersion?: string;
  onModeChange: (mode: "development" | "release") => void;
}

export function LibraryReleaseSourceControl(props: LibraryReleaseSourceControlProps) {
  const [status, setStatus] = useState<LibraryReleaseStatus>();
  const [query, setQuery] = useState("");
  const [busyVersion, setBusyVersion] = useState<string>();
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    try {
      const next = await runLocalOperation<LibraryReleaseStatus>({ type: "get-library-releases" });
      setStatus(next);
      setError(undefined);
      return next;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Library versions are unavailable.");
      return undefined;
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const currentVersion = status?.currentVersion ?? cleanVersion(props.fallbackVersion);
  const visibleVersions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return status?.versions.filter((entry) => (
      !normalizedQuery
      || entry.version.toLocaleLowerCase().includes(normalizedQuery)
      || entry.version === status.latestVersion && "latest".includes(normalizedQuery)
    )) ?? [];
  }, [query, status]);

  async function install(version: string) {
    if (version === currentVersion) {
      props.onModeChange("release");
      return;
    }
    setBusyVersion(version);
    setError(undefined);
    try {
      const next = await runLocalOperation<LibraryReleaseStatus>({
        type: "install-library-release",
        version,
      });
      setStatus(next);
      props.onModeChange("release");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The library version could not be installed.");
    } finally {
      setBusyVersion(undefined);
    }
  }

  return (
    <div className="min-w-0">
      <Select
        aria-label="Installed library version"
        className="min-w-0"
        isDisabled={Boolean(busyVersion)}
        selectedKey={currentVersion}
        onOpenChange={(open) => {
          if (open && !status) void load();
          if (!open) setQuery("");
        }}
        onSelectionChange={(key) => {
          const version = String(key);
          if (version) void install(version);
        }}
      >
        <Select.Trigger className={`flex h-9 w-full min-w-0 items-center justify-start gap-1.5 rounded-full px-2.5 text-left outline-none transition-colors ${
          props.active ? "bg-white/[0.08] text-zinc-100" : "text-zinc-500 hover:bg-white/[0.04]"
        }`}>
          <span className={props.active ? "text-sky-300" : "text-zinc-600"}>
            {busyVersion ? <LoaderCircle className="size-3 animate-spin" /> : <PackageCheck className="size-3" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[10px] font-medium leading-3.5">Installed</span>
            <span className="block truncate text-[8px] leading-3 text-zinc-600">
              {busyVersion ? `Installing ${busyVersion}` : currentVersion ?? "Choose version"}
            </span>
          </span>
          <Select.Indicator className="size-3 shrink-0 text-zinc-600" />
        </Select.Trigger>
        <Select.Popover className="min-w-64 rounded-2xl bg-[#1b1c20] p-2 shadow-2xl" placement="bottom">
          <div className="mb-2 px-1 pt-1">
            <p className="text-[11px] font-medium text-zinc-200">Published versions</p>
            <p className="mt-0.5 text-[9px] text-zinc-600">Choose a release to install and preview.</p>
          </div>
          <div className="mb-1.5 flex h-8 items-center gap-2 rounded-full bg-white/[0.055] px-2.5 transition-colors focus-within:bg-white/[0.09]">
            <Search aria-hidden="true" className="size-3 shrink-0 text-zinc-600" />
            <Input
              aria-label="Search library versions"
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent text-[10px] text-zinc-200 outline-none placeholder:text-zinc-600"
              placeholder="Search versions"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key !== "Escape") event.stopPropagation();
              }}
            />
          </div>
          <ListBox items={visibleVersions}>
            {(entry) => (
              <LibraryReleaseVersionItem
                currentVersion={currentVersion}
                entry={entry}
                latestVersion={status?.latestVersion}
              />
            )}
          </ListBox>
          {!status && !error ? (
            <div className="flex items-center justify-center gap-2 px-2 py-5 text-[9px] text-zinc-600">
              <LoaderCircle className="size-3 animate-spin" /> Loading releases
            </div>
          ) : null}
          {status && !visibleVersions.length ? (
            <p className="px-2 py-4 text-center text-[9px] text-zinc-600">No matching versions</p>
          ) : null}
        </Select.Popover>
      </Select>
      {error ? <p className="mt-1.5 px-2 text-[8px] leading-3 text-rose-300">{error}</p> : null}
    </div>
  );
}

function cleanVersion(version?: string): string | undefined {
  return version?.replace(/^[~^<>=\s]+/, "");
}
