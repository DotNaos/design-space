
import { RenderedDiffFile } from "./RenderedDiff";
import { DiffLine } from "./DiffLine";

export function DiffBody({ file }: { file: RenderedDiffFile }) {
  return (
      <div
        aria-label="Source diff, scroll in both directions"
        className="min-h-0 flex-1 touch-auto overflow-auto overscroll-contain py-2 font-mono text-[11px] leading-5"
        role="region"
        tabIndex={0}
      >
        <div className="min-w-max" role="table">
          {file.lines.map((line, index) => (
            <DiffLine key={`${index}:${line.text}`} line={line} />
          ))}
        </div>
      </div>
  );
}
