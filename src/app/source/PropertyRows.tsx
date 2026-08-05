
import { SourceReviewGraphProperty } from "./SourceReviewGraphStage";

export function PropertyRows(props: { properties: readonly SourceReviewGraphProperty[] }) {
  if (!props.properties.length) {
    return <p className="px-2.5 py-2 text-[9px] text-zinc-600">No design properties</p>;
  }
  const visible = props.properties.slice(0, 3);
  return (
    <div className="flex min-w-0 items-center gap-1 overflow-hidden p-1.5">
      {visible.map((property) => (
        <span key={property.name} className="min-w-0 max-w-40 truncate rounded-md bg-white/[0.04] px-2 py-1 text-[9px] text-zinc-400">
          <strong className="font-medium text-zinc-200">{property.name}</strong>
          <span className="text-zinc-600"> · </span>
          {property.value ?? property.type}
          {property.required ? <span className="text-amber-300/80"> *</span> : null}
        </span>
      ))}
      {props.properties.length > visible.length ? (
        <span className="shrink-0 px-1 text-[9px] text-zinc-600">+{props.properties.length - visible.length}</span>
      ) : null}
    </div>
  );
}
