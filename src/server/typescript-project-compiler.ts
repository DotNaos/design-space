import { resolve } from "node:path";

import ts from "typescript";

import { DesignSpaceError } from "./errors";

export function assertEditedTypeScriptCompiles(root: string, filePath: string, nextSource: string): void {
  const configPath = ts.findConfigFile(root, ts.sys.fileExists, "tsconfig.json");
  if (!configPath) return;
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) throw compileError(config.error);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root, undefined, configPath);
  const canonicalEditPath = resolve(filePath);
  const host = ts.createCompilerHost(parsed.options, true);
  const readFile = host.readFile.bind(host);
  host.readFile = (candidate) => resolve(candidate) === canonicalEditPath ? nextSource : readFile(candidate);
  const rootNames = parsed.fileNames.some((candidate) => resolve(candidate) === canonicalEditPath)
    ? parsed.fileNames
    : [...parsed.fileNames, canonicalEditPath];
  const program = ts.createProgram({
    rootNames,
    options: parsed.options,
    projectReferences: parsed.projectReferences,
    host,
  });
  const diagnostic = ts.getPreEmitDiagnostics(program).find((candidate) => (
    candidate.file && resolve(candidate.file.fileName) === canonicalEditPath
  ));
  if (diagnostic) throw compileError(diagnostic);
}

function compileError(diagnostic: ts.Diagnostic): DesignSpaceError {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
  return new DesignSpaceError("COMPILE_ERROR", "The edited TypeScript source did not compile", { diagnostic: message });
}
