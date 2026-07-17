import { useEffect, useMemo, useRef, useState } from "react";

import type { SourceDraftAnalysis } from "../../shared/contracts";
import type { RuntimeSourceWorkspace } from "../../shared/source-workspace";
import { runLocalOperation } from "../api";
import type { SourceFileEditor } from "./useSourceFileEditor";

export function useSourceDraftAnalysis(
  workspace: RuntimeSourceWorkspace,
  editor: SourceFileEditor,
): { workspace: RuntimeSourceWorkspace; analyzing: boolean; error?: string } {
  const request = useRef(0);
  const [analysis, setAnalysis] = useState<SourceDraftAnalysis>();
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string>();
  const fileId = editor.snapshot?.fileId;

  useEffect(() => {
    const current = ++request.current;
    if (!fileId || !editor.dirty) {
      setAnalysis(undefined);
      setAnalyzing(false);
      setError(undefined);
      return;
    }
    setAnalyzing(true);
    const timer = window.setTimeout(() => {
      void runLocalOperation<SourceDraftAnalysis>({
        type: "analyze-source-file-draft",
        fileId,
        source: editor.draft,
      }).then((result) => {
        if (request.current !== current) return;
        setAnalysis(result);
        setError(undefined);
      }).catch((reason: unknown) => {
        if (request.current !== current) return;
        setError(reason instanceof Error ? reason.message : "The source draft could not be analyzed.");
      }).finally(() => {
        if (request.current === current) setAnalyzing(false);
      });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [editor.dirty, editor.draft, fileId]);

  const effective = useMemo<RuntimeSourceWorkspace>(() => {
    if (!analysis) return workspace;
    const byIdentity = new Map(analysis.components.map((component) => [`${component.filePath}:${component.exportName}`, component]));
    return {
      ...workspace,
      entries: workspace.entries.map((entry) => {
        const component = byIdentity.get(`${entry.relativePath}:${entry.exportName}`);
        return component ? { ...entry, ...component, component: entry.component } : entry;
      }),
    };
  }, [analysis, workspace]);
  return { workspace: effective, analyzing, ...(error ? { error } : {}) };
}
