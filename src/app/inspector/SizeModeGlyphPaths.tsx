
import { SizeMode } from "./TailwindSizeControl";

export function SizeModeGlyphPaths(props: { mode: SizeMode }) {
  const shared = { stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, strokeWidth: 1.35 };
  if (props.mode === "auto") {
    return <path d="M3 9h12" strokeDasharray="1.25 2.25" {...shared} />;
  }
  if (props.mode === "css-auto") {
    return <path d="M3 5v8m12-8v8M6 9h6" {...shared} />;
  }
  if (props.mode === "full") {
    return <path d="M2.5 4.5v9m13-9v9M5 9h8m-6-2L5 9l2 2m4-4 2 2-2 2" {...shared} />;
  }
  if (props.mode === "screen") {
    return <path d="M2.5 4h13v10h-13zM5 9h8" {...shared} />;
  }
  if (props.mode === "fit") {
    return <path d="M2.5 5v8m13-8v8M5 9h3m-2-2 2 2-2 2m7-2h-3m2-2-2 2 2 2" {...shared} />;
  }
  if (props.mode === "min") {
    return <path d="M9 5v8M3.5 9H7m-2-2 2 2-2 2m9.5-2H11m2-2-2 2 2 2" {...shared} />;
  }
  return <path d="M2.5 5v8m13-8v8M9 9H5m2-2-2 2 2 2m2-2h4m-2-2 2 2-2 2" {...shared} />;
}
