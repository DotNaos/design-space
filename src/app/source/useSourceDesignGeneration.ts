import { useState } from "react";

import type { GeneratedSourceDesign } from "../../shared/contracts";
import type { SourceDesignScope } from "../../shared/source-design";
import { runLocalOperation } from "../api";

export function useSourceDesignGeneration(options: {
  onAppGenerated: () => void;
}) {
  const [state, setState] = useState<{ entryId?: string; error?: string }>({});

  const generate = async (scope: SourceDesignScope, entryId: string) => {
    if (state.entryId && !state.error) return;
    setState({ entryId });
    try {
      await runLocalOperation<GeneratedSourceDesign>({
        type: "generate-source-design",
        scope,
        entryId,
      });
      if (scope === "app") options.onAppGenerated();
      setState({});
      window.setTimeout(() => window.location.reload(), 3_500);
    } catch (error) {
      setState({
        entryId,
        error: error instanceof Error
          ? error.message
          : "The design file could not be generated.",
      });
    }
  };

  return { ...state, generate };
}
