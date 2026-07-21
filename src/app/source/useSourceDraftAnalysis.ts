import { useEffect, useMemo, useRef, useState } from "react";

import type { SourceDraftAnalysis } from "../../shared/contracts";
import type { SourceDesignScope } from "../../shared/source-design";
import type { RuntimeSourceWorkspace } from "../../shared/source-workspace";
import { runLocalOperation } from "../api";
import type { SourceCodeEditor } from "./SourceCodeCanvas";

export function useSourceDraftAnalysis(
  workspace: RuntimeSourceWorkspace,
  editor: SourceCodeEditor,
  scope: SourceDesignScope = "app",
): { workspace: RuntimeSourceWorkspace; analyzing: boolean; ready: boolean; error?: string } {
  const request = useRef(0);
  const [result, setResult] = useState<{
    fileId: string;
    source: string;
    scope: SourceDesignScope;
    status: "pending" | "success" | "error";
    analysis?: SourceDraftAnalysis;
    error?: string;
  }>();
  const fileId = editor.snapshot?.fileId;

  useEffect(() => {
    const current = ++request.current;
    if (!fileId || !editor.dirty) {
      setResult(undefined);
      return;
    }
    const source = editor.draft;
    setResult({ fileId, source, scope, status: "pending" });
    const timer = window.setTimeout(() => {
      void runLocalOperation<SourceDraftAnalysis>({
        type: "analyze-source-file-draft",
        fileId,
        source,
        scope,
      }).then((result) => {
        if (request.current !== current) return;
        setResult({ fileId, source, scope, status: "success", analysis: result });
      }).catch((reason: unknown) => {
        if (request.current !== current) return;
        setResult({
          fileId,
          source,
          scope,
          status: "error",
          error: reason instanceof Error ? reason.message : "The source draft could not be analyzed.",
        });
      });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [editor.dirty, editor.draft, fileId, scope]);

  const current = Boolean(
    result
    && result.fileId === fileId
    && result.source === editor.draft
    && result.scope === scope,
  );
  const analysis = current && result?.status === "success" ? result.analysis : undefined;
  const analyzing = Boolean(fileId && editor.dirty && (!current || result?.status === "pending"));
  const ready = !editor.dirty || Boolean(current && result?.status === "success" && analysis);
  const error = current && result?.status === "error" ? result.error : undefined;

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
  return { workspace: effective, analyzing, ready, ...(error ? { error } : {}) };
}
