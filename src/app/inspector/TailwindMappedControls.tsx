type UtilityOption = { label: string; value: string };
type UtilityGroup = {
  id: string;
  label: string;
  options: readonly UtilityOption[];
  matches: (utility: string) => boolean;
};

const groups: readonly UtilityGroup[] = [
  { id: "display", label: "Display", options: options(["block", "flex", "grid", "hidden"]), matches: match(/^(?:block|inline-block|inline|flex|inline-flex|grid|inline-grid|hidden|contents|flow-root|table(?:-.+)?)$/) },
  { id: "direction", label: "Direction", options: options(["flex-row", "flex-col"]), matches: match(/^flex-(?:row|row-reverse|col|col-reverse)$/) },
  { id: "align", label: "Align", options: options(["items-start", "items-center", "items-end", "items-stretch"]), matches: match(/^items-.+$/) },
  { id: "justify", label: "Justify", options: options(["justify-start", "justify-center", "justify-end", "justify-between"]), matches: match(/^justify-(?!(?:items|self)-).+$/) },
  { id: "gap", label: "Gap", options: options(["gap-0", "gap-1", "gap-2", "gap-3", "gap-4", "gap-6", "gap-8"]), matches: match(/^gap(?:-[xy])?-.+$/) },
  { id: "padding", label: "Padding", options: options(["p-0", "p-1", "p-2", "p-3", "p-4", "p-6", "p-8"]), matches: match(/^p[trblxyse]?-.+$/) },
  { id: "radius", label: "Radius", options: options(["rounded-none", "rounded-sm", "rounded", "rounded-md", "rounded-lg", "rounded-xl", "rounded-2xl", "rounded-full"]), matches: match(/^rounded(?:-.+)?$/) },
];

export function TailwindMappedControls(props: { value: string; onChange: (value: string) => void }) {
  const tokens = props.value.split(/\s+/).filter(Boolean);
  return (
    <fieldset>
      <legend className="mb-2 text-[10px] text-zinc-500">Visual controls · Tailwind only</legend>
      <div className="grid grid-cols-2 gap-2">
        {groups.map((group) => {
          const allowed = group.options.map((option) => option.value);
          const selected = tokens.find((token) => allowed.includes(token)) ?? "";
          return (
            <label key={group.id} className="block min-w-0">
              <span className="mb-1 block text-[9px] text-zinc-600">{group.label}</span>
              <select
                aria-label={`${group.label} Tailwind utility`}
                className="min-h-10 w-full rounded-lg border border-white/10 bg-black/20 px-2 text-xs text-zinc-200 outline-none focus:border-sky-400"
                value={selected}
                onChange={(event) => props.onChange(replaceTailwindUtilityGroup(props.value, allowed, event.currentTarget.value, group.matches))}
              >
                <option value="">Auto</option>
                {group.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function replaceTailwindUtilityGroup(
  current: string,
  group: readonly string[],
  next: string,
  matches: (utility: string) => boolean = (utility) => group.includes(utility),
): string {
  const candidates = new Set(group);
  const tokens = current.split(/\s+/).filter((token) => {
    if (!token) return false;
    const utility = tailwindUtility(token);
    return !candidates.has(utility) && !matches(utility);
  });
  if (next) tokens.push(next);
  return tokens.join(" ");
}

function options(values: readonly string[]): UtilityOption[] {
  return values.map((value) => ({ label: value, value }));
}

function match(pattern: RegExp) {
  return (utility: string) => pattern.test(utility);
}

function tailwindUtility(token: string): string {
  let bracketDepth = 0;
  let variantEnd = -1;
  for (let index = 0; index < token.length; index += 1) {
    if (token[index] === "[") bracketDepth += 1;
    else if (token[index] === "]") bracketDepth = Math.max(0, bracketDepth - 1);
    else if (token[index] === ":" && bracketDepth === 0) variantEnd = index;
  }
  return token.slice(variantEnd + 1).replace(/^!/, "");
}
