import { CircleAlert } from "lucide-react";

export function SourcePreviewState(props: {
  action?: React.ReactNode;
  error?: string;
  message: string;
  title: string;
  tone?: "error" | "neutral";
}) {
  const isError = props.tone === "error" || Boolean(props.error);
  return (
    <section
      aria-live={isError ? "assertive" : undefined}
      className="grid h-full min-h-0 place-items-center bg-[#0d0e10] px-8 text-center"
      role={isError ? "alert" : undefined}
    >
      <div className="max-w-sm">
        {isError ? <CircleAlert aria-hidden="true" className="mx-auto text-red-400" size={24} /> : null}
        <h2 className={`text-sm font-semibold ${isError ? "mt-3 text-red-200" : "text-zinc-200"}`}>{props.title}</h2>
        <p className={`mt-2 text-xs leading-5 ${isError ? "text-red-300/80" : "text-zinc-500"}`}>{props.message}</p>
        {props.error ? (
          <p className="mt-3 max-h-24 overflow-auto border-t border-red-500/20 pt-3 font-mono text-[10px] leading-4 text-red-300/70">
            {props.error}
          </p>
        ) : null}
        {props.action ? <div className="mt-4 flex justify-center">{props.action}</div> : null}
      </div>
    </section>
  );
}
