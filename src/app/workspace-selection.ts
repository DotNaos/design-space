import type { TargetModule } from "../shared/target-module";

export function usesDocumentWorkspace(target: TargetModule): boolean {
  return (
    target.defaultDocumentId !== undefined ||
    target.documents !== undefined ||
    target.componentRecipes !== undefined
  );
}
