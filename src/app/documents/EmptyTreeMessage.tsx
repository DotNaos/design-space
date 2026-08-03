

export function EmptyTreeMessage(props: { kind: "pages" | "components"; query: string }) {
  return <p className="px-2 py-2 text-[10px] leading-4 text-zinc-600">{props.query.trim() ? `No ${props.kind} match “${props.query.trim()}”.` : `No ${props.kind} are registered yet.`}</p>;
}
