import { useEffect, useRef, useState } from "react";
import { Button } from "@heroui/react";
import { ArrowLeft, FileCode2, LockKeyhole } from "lucide-react";

import type { ProjectFileSnapshot } from "../../shared/contracts";
import type { TargetFileEntry } from "../../shared/target-module";
import { runLocalOperation } from "../api";
import { ProjectFileBrowser } from "./ProjectFileBrowser";

export function ProjectFilesWorkspace(props: {
  className?: string;
  files: readonly TargetFileEntry[];
  requestedFileId?: string;
  onSelect?: (fileId: string) => void;
  loadFile?: (fileId: string) => Promise<ProjectFileSnapshot>;
}) {
  const requestId = useRef(0);
  const [selectedFileId, setSelectedFileId] = useState<string>();
  const [snapshot, setSnapshot] = useState<ProjectFileSnapshot>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => () => {
    requestId.current += 1;
  }, []);

  const openFile = (fileId: string) => {
    const currentRequest = ++requestId.current;
    setSelectedFileId(fileId);
    setSnapshot(undefined);
    setError(undefined);
    setLoading(true);
    props.onSelect?.(fileId);
    const fail = (reason: unknown) => {
      if (requestId.current === currentRequest) {
        setError(reason instanceof Error ? reason.message : "This registered source file is unavailable.");
      }
    };
    let request: Promise<ProjectFileSnapshot>;
    try {
      request = props.loadFile?.(fileId) ?? runLocalOperation<ProjectFileSnapshot>({ type: "read-project-file", fileId });
    } catch (reason) {
      fail(reason);
      setLoading(false);
      return;
    }
    void request
      .then((result) => {
        if (requestId.current === currentRequest) setSnapshot(result);
      }, fail)
      .finally(() => {
        if (requestId.current === currentRequest) setLoading(false);
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    if (props.requestedFileId && props.requestedFileId !== selectedFileId) openFile(props.requestedFileId);
  }, [props.requestedFileId]);

  const closeFile = () => {
    requestId.current += 1;
    setSelectedFileId(undefined);
    setSnapshot(undefined);
    setError(undefined);
    setLoading(false);
  };

  if (!selectedFileId) {
    return <ProjectFileBrowser className={props.className} files={props.files} onSelect={openFile} />;
  }

  const selectedFile = props.files.find((entry) => entry.id === selectedFileId);
  return (
    <aside aria-label="Read-only project source" className={`${props.className ?? "flex w-64"} min-w-0 shrink-0 flex-col bg-[#141518]`}>
      <header className="flex min-h-12 items-center gap-2 border-b border-white/10 px-2">
        <Button aria-label="Back to project files" isIconOnly size="sm" variant="ghost" onPress={closeFile}>
          <ArrowLeft aria-hidden="true" size={14} />
        </Button>
        <FileCode2 aria-hidden="true" className="shrink-0 text-sky-300" size={14} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xs font-medium text-zinc-300">{snapshot?.label ?? selectedFile?.label ?? "Project source"}</h2>
          <p className="mt-0.5 flex items-center gap-1 text-[9px] text-zinc-600"><LockKeyhole aria-hidden="true" size={10} /> Read only · allowlisted source</p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        {loading && <p className="p-4 text-xs text-zinc-500">Opening current source…</p>}
        {error && (
          <div className="p-4">
            <p className="text-xs font-medium text-amber-300">Source unavailable</p>
            <p className="mt-2 text-xs leading-5 text-zinc-500">{error}</p>
            <p className="mt-3 text-[10px] leading-4 text-zinc-600">Only files explicitly registered by the target server can be opened.</p>
          </div>
        )}
        {snapshot && (
          <pre className="min-h-full min-w-max p-4 font-mono text-[11px] leading-5 text-zinc-400" tabIndex={0}>
            <code>{snapshot.source}</code>
          </pre>
        )}
      </div>
    </aside>
  );
}
