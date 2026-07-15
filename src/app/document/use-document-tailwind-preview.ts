import { useEffect, useMemo, useState } from "react";

import type { TailwindPreview } from "../../shared/contracts";
import type { DesignDocument } from "../../shared/design-document";
import { collectDocumentTailwind } from "../../shared/document-tailwind";
import type { TargetModule } from "../../shared/target-module";
import { runLocalOperation } from "../api";

export function useDocumentTailwindPreview(options: {
  target: TargetModule;
  library: readonly DesignDocument[];
  document: DesignDocument;
  connected: boolean;
  sessionId?: string;
}) {
  const [css, setCss] = useState("");
  const [compiledValue, setCompiledValue] = useState<string>();
  const [error, setError] = useState<string>();
  const input = useMemo(
    () => collectDocumentTailwind(options.target, options.library, options.document),
    [options.document, options.library, options.target],
  );

  useEffect(() => {
    if (!options.connected || !options.sessionId) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const result = await runLocalOperation<TailwindPreview>({ type: "compile-tailwind", value: input });
        if (!cancelled) {
          setCss(result.css);
          setCompiledValue(result.value);
          setError(undefined);
        }
      } catch (compileError) {
        if (!cancelled) setError(compileError instanceof Error ? compileError.message : "The preview did not compile.");
      }
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [input, options.connected, options.sessionId]);

  return { input, css, error, ready: compiledValue === input && !error };
}
