import * as typeScriptContribution from "monaco-editor/esm/vs/language/typescript/monaco.contribution.js";

export function configureMonacoTypeScript() {
  const diagnostics = {
    // Editors open trusted files in isolation. Repository-wide semantic
    // validation remains the server compiler's responsibility.
    noSemanticValidation: true,
    noSyntaxValidation: false,
  };
  type LanguageDefaults = {
    getCompilerOptions: () => Record<string, unknown>;
    setCompilerOptions: (options: Record<string, unknown>) => void;
    setDiagnosticsOptions: (options: typeof diagnostics) => void;
  };
  const contribution = typeScriptContribution as unknown as {
    JsxEmit: { ReactJSX: number };
    javascriptDefaults: LanguageDefaults;
    typescriptDefaults: LanguageDefaults;
  };
  for (const language of [contribution.typescriptDefaults, contribution.javascriptDefaults]) {
    language.setCompilerOptions({
      ...language.getCompilerOptions(),
      allowNonTsExtensions: true,
      jsx: contribution.JsxEmit.ReactJSX,
    });
    language.setDiagnosticsOptions(diagnostics);
  }
}

export function sourceLanguageFor(path: string): string {
  if (/\.tsx?$/i.test(path)) return "typescript";
  if (/\.jsx?$/i.test(path)) return "javascript";
  if (/\.json$/i.test(path)) return "json";
  if (/\.(?:css|scss|less)$/i.test(path)) return "css";
  if (/\.(?:html|htm)$/i.test(path)) return "html";
  return "plaintext";
}
