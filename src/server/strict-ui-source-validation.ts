import { relative, resolve, sep } from "node:path";

import { DesignSpaceError } from "./errors";
import {
  indexTypeScriptComponents,
  type IndexedTypeScriptComponent,
} from "./typescript-component-index";

export interface StrictUiSourceChange {
  filePath: string;
  source: string;
}

export interface StrictUiSourceValidationOptions {
  projectRoot: string;
  filePaths: readonly string[];
  changes: readonly StrictUiSourceChange[];
}

/**
 * Validates all drafts in one compiler view so component contracts and their
 * consumers cannot observe different versions of the same change set.
 */
export async function assertStrictUiSourceChangesDoNotRegress(
  options: StrictUiSourceValidationOptions,
): Promise<void> {
  const filePaths = [...new Set([
    ...options.filePaths,
    ...options.changes.map((change) => change.filePath),
  ])];
  const sourceOverrides = new Map<string, string>();
  for (const change of options.changes) {
    const absolutePath = resolve(change.filePath);
    sourceOverrides.set(absolutePath, change.source);
    sourceOverrides.set(absolutePath.replaceAll("\\", "/"), change.source);
  }

  const [current, edited] = await Promise.all([
    indexTypeScriptComponents({ projectRoot: options.projectRoot, filePaths }),
    indexTypeScriptComponents({
      projectRoot: options.projectRoot,
      filePaths,
      sourceOverrides,
    }),
  ]);
  const changedFiles = new Set(options.changes.map((change) => (
    relative(resolve(options.projectRoot), resolve(change.filePath)).split(sep).join("/")
  )));
  const invalidChangedSlot = findings(edited).find(({ component, finding }) => (
    changedFiles.has(component.filePath) &&
    (finding.ruleId === "strict-ui.slot-content-missing" ||
      finding.ruleId === "strict-ui.slot-content-incompatible")
  ));
  if (invalidChangedSlot) reject(invalidChangedSlot);

  const baseline = new Set(findings(current).map(findingIdentity));
  const regression = findings(edited).find((entry) => !baseline.has(findingIdentity(entry)));
  if (regression) reject(regression);
}

interface ComponentFinding {
  component: IndexedTypeScriptComponent;
  finding: IndexedTypeScriptComponent["findings"][number];
}

function findings(components: readonly IndexedTypeScriptComponent[]): ComponentFinding[] {
  return components.flatMap((component) => (
    component.findings.map((finding) => ({ component, finding }))
  ));
}

function findingIdentity({ component, finding }: ComponentFinding): string {
  return `${component.filePath}:${component.exportName}:${finding.ruleId}:${finding.message}`;
}

function reject({ component, finding }: ComponentFinding): never {
  throw new DesignSpaceError(
    "COMPILE_ERROR",
    `Strict UI rejected ${component.label}: ${finding.message}`,
  );
}
