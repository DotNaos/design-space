
import { SizeAxis } from "./TailwindSizeControl";

export function AxisGlyph(props: { axis: SizeAxis }) {
  return (
    <svg aria-hidden="true" className="size-3 text-zinc-600" fill="none" viewBox="0 0 12 12">
      {props.axis === "width" ? (
        <path d="M1.5 3v6m9-6v6M3.5 6h5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.1" />
      ) : (
        <path d="M3 1.5h6m-6 9h6M6 3.5v5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.1" />
      )}
    </svg>
  );
}
