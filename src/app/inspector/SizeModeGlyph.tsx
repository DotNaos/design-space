
import { SizeAxis, SizeMode } from "./TailwindSizeControl";
import { SizeModeGlyphPaths } from "./SizeModeGlyphPaths";

export function SizeModeGlyph(props: { axis: SizeAxis; mode: SizeMode }) {
  return (
    <svg
      aria-hidden="true"
      className={`size-4 ${props.axis === "height" ? "rotate-90" : ""}`}
      fill="none"
      viewBox="0 0 18 18"
    >
      <SizeModeGlyphPaths mode={props.mode} />
    </svg>
  );
}
