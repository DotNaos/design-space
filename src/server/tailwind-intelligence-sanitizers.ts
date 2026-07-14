import type { TailwindCompletion, TailwindDiagnostic } from "../shared/contracts";

export const tailwindWrapperPrefix = '<div className="';
export const tailwindWrapperSuffix = '"></div>';
export const unsafeTailwindClassFieldCharacters = /[\x00-\x1f\x7f"`\\<>\u2028\u2029]/;

const maximumCompletions = 100;
const maximumCompletionCandidates = 50_000;
const maximumDiagnostics = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeText(value: unknown, maximumLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.replace(/[\x00-\x1f\x7f]+/g, " ").trim().slice(0, maximumLength) || undefined;
}

function positionCharacter(value: unknown): number | undefined {
  if (!isRecord(value) || value.line !== 0 || !Number.isInteger(value.character)) return undefined;
  const character = value.character as number;
  return character >= 0 ? character : undefined;
}

function mappedRange(value: unknown, fieldLength: number): { start: number; end: number } | undefined {
  if (!isRecord(value)) return undefined;
  const start = positionCharacter(value.start);
  const end = positionCharacter(value.end);
  if (start === undefined || end === undefined) return undefined;
  const fieldStart = tailwindWrapperPrefix.length;
  const fieldEnd = fieldStart + fieldLength;
  if (start < fieldStart || end < start || end > fieldEnd) return undefined;
  return { start: start - fieldStart, end: end - fieldStart };
}

function currentTokenRange(value: string, cursor: number): { start: number; end: number } {
  let start = cursor;
  let end = cursor;
  while (start > 0 && !/\s/.test(value[start - 1] ?? "")) start -= 1;
  while (end < value.length && !/\s/.test(value[end] ?? "")) end += 1;
  return { start, end };
}

function completionMatchScore(label: string, insertText: string, query: string): number | undefined {
  if (!query) return 1_000;
  const needle = query.toLowerCase();
  const choices = [insertText.toLowerCase(), label.toLowerCase()];
  let best: number | undefined;
  for (const choice of choices) {
    let score: number | undefined;
    if (choice === needle) score = 0;
    else if (choice.startsWith(needle)) score = 10 + choice.length - needle.length;
    else {
      let offset = 0;
      let gaps = 0;
      for (const character of needle) {
        const next = choice.indexOf(character, offset);
        if (next < 0) {
          gaps = -1;
          break;
        }
        gaps += next - offset;
        offset = next + 1;
      }
      if (gaps >= 0) score = 100 + gaps;
    }
    if (score !== undefined && (best === undefined || score < best)) best = score;
  }
  return best;
}

function completionItems(value: unknown): { items: unknown[]; defaults?: Record<string, unknown> } {
  if (Array.isArray(value)) return { items: value };
  if (!isRecord(value) || !Array.isArray(value.items)) return { items: [] };
  return { items: value.items, defaults: isRecord(value.itemDefaults) ? value.itemDefaults : undefined };
}

export function sanitizeTailwindCompletions(raw: unknown, value: string, cursor: number): TailwindCompletion[] {
  const { items, defaults } = completionItems(raw);
  const token = currentTokenRange(value, cursor);
  const query = value.slice(token.start, cursor);
  const completions: Array<{ completion: TailwindCompletion; score: number; order: number }> = [];
  const seen = new Set<string>();
  for (const [order, candidate] of items.slice(0, maximumCompletionCandidates).entries()) {
    if (!isRecord(candidate)) continue;
    if (candidate.command !== undefined) continue;
    if (Array.isArray(candidate.additionalTextEdits) && candidate.additionalTextEdits.length > 0) continue;
    const insertTextFormat = candidate.insertTextFormat ?? defaults?.insertTextFormat;
    if (insertTextFormat === 2) continue;
    const textEdit = isRecord(candidate.textEdit) ? candidate.textEdit : undefined;
    const rawInsertText = textEdit?.newText ?? candidate.insertText ?? candidate.label;
    const insertText = typeof rawInsertText === "string" && rawInsertText.length <= 1_000
      ? rawInsertText
      : undefined;
    const label = safeText(candidate.label, 300);
    if (!label || !insertText || /\s/.test(insertText) || unsafeTailwindClassFieldCharacters.test(insertText)) continue;
    const score = completionMatchScore(label, insertText, query);
    if (score === undefined) continue;
    const defaultEditRange = isRecord(defaults?.editRange)
      ? defaults.editRange.replace ?? defaults.editRange.insert ?? defaults.editRange
      : defaults?.editRange;
    const editRange = textEdit?.range ?? textEdit?.replace ?? defaultEditRange;
    const range = editRange === undefined
      ? currentTokenRange(value, cursor)
      : mappedRange(editRange, value.length);
    if (!range) continue;
    if (range.start > cursor || range.end < cursor) continue;
    const key = `${range.start}:${range.end}:${insertText}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const documentationValue = isRecord(candidate.documentation)
      ? candidate.documentation.value
      : candidate.documentation;
    completions.push({
      score,
      order,
      completion: {
        label,
        insertText,
        replaceStart: range.start,
        replaceEnd: range.end,
        detail: safeText(candidate.detail, 500),
        documentation: safeText(documentationValue, 2_000),
      },
    });
  }
  return completions
    .sort((left, right) => left.score - right.score || left.order - right.order)
    .slice(0, maximumCompletions)
    .map(({ completion }) => completion);
}

function diagnosticSeverity(value: unknown): TailwindDiagnostic["severity"] {
  if (value === 1) return "error";
  if (value === 2) return "warning";
  return "information";
}

export function sanitizeTailwindDiagnostics(raw: unknown, valueLength: number): TailwindDiagnostic[] {
  if (!isRecord(raw)) return [];
  const candidates = Array.isArray(raw.diagnostics) ? raw.diagnostics : Array.isArray(raw.items) ? raw.items : undefined;
  if (!candidates) return [];
  const diagnostics: TailwindDiagnostic[] = [];
  for (const candidate of candidates) {
    if (diagnostics.length >= maximumDiagnostics || !isRecord(candidate)) break;
    const range = mappedRange(candidate.range, valueLength);
    const message = safeText(candidate.message, 1_000);
    if (!range || !message) continue;
    const rawCode = candidate.code;
    const code = typeof rawCode === "string" || typeof rawCode === "number"
      ? String(rawCode).slice(0, 100)
      : undefined;
    diagnostics.push({ message, code, severity: diagnosticSeverity(candidate.severity), ...range });
  }
  return diagnostics;
}
