
import { type BoxKind } from "./tailwind-box-model-values";
import { boxHue } from "./TailwindBoxModelValueRows";

export function BoxKindIcon(props: { active: boolean; kind: BoxKind }) {
  const color = `hsl(${boxHue[props.kind]} 74% 60%)`;
  return (
    <span
      aria-hidden="true"
      className="flex size-6 shrink-0 items-center justify-center rounded-md bg-[#191b20]"
      data-box-kind-icon={props.kind}
      style={{ color, opacity: props.active ? 1 : 0.72 }}
    >
      <svg fill="none" height="16" viewBox="0 0 16 16" width="16">
        {props.kind === "border" ? (
          <>
            <rect height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" width="10" x="3" y="3" />
            <rect height="5" rx="1" stroke="currentColor" strokeOpacity="0.38" width="5" x="5.5" y="5.5" />
          </>
        ) : (
          <>
            <rect height="8" rx="1.3" stroke="currentColor" strokeOpacity="0.4" width="8" x="4" y="4" />
            <path
              d={props.kind === "padding" ? "M2 8h4m8 0h-4M4 6l2 2-2 2m8-4-2 2 2 2" : "M6 8H2m12 0h-4M4 6 2 8l2 2m8-4 2 2-2 2"}
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.35"
            />
          </>
        )}
      </svg>
    </span>
  );
}
