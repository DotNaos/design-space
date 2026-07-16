import { createContext, useContext } from "react";

export const SourcePreviewRuntimeContext = createContext(false);

export function useSourcePreviewRuntime(): boolean {
  return useContext(SourcePreviewRuntimeContext);
}
