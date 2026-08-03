
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MarkdownCode } from "./MarkdownCode";

export function SourceCodexMessageContent(props: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ children, ...linkProps }) => (
          <a
            {...linkProps}
            className="font-medium text-sky-300 underline decoration-sky-400/40 underline-offset-2 hover:text-sky-200"
            rel="noreferrer"
            target="_blank"
          >
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="my-3 border-l-2 border-sky-400/40 pl-3 text-zinc-400">{children}</blockquote>
        ),
        code: MarkdownCode,
        h1: ({ children }) => <h1 className="mb-3 mt-5 text-base font-semibold text-zinc-100 first:mt-0">{children}</h1>,
        h2: ({ children }) => <h2 className="mb-2 mt-5 text-sm font-semibold text-zinc-100 first:mt-0">{children}</h2>,
        h3: ({ children }) => <h3 className="mb-2 mt-4 text-xs font-semibold text-zinc-200 first:mt-0">{children}</h3>,
        hr: () => <hr className="my-4 border-white/10" />,
        li: ({ children }) => <li className="pl-0.5">{children}</li>,
        ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-5">{children}</ol>,
        p: ({ children }) => <p className="my-2 break-words first:mt-0 last:mb-0">{children}</p>,
        pre: ({ children }) => (
          <pre className="my-3 overflow-x-auto rounded-lg border border-white/10 bg-black/35 p-3 text-[11px] leading-5 text-zinc-200">
            {children}
          </pre>
        ),
        table: ({ children }) => (
          <div className="my-3 overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full border-collapse text-left text-[11px]">{children}</table>
          </div>
        ),
        td: ({ children }) => <td className="border-t border-white/8 px-3 py-2 align-top">{children}</td>,
        th: ({ children }) => <th className="bg-white/[0.035] px-3 py-2 font-semibold text-zinc-200">{children}</th>,
        ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-5">{children}</ul>,
      }}
    >
      {props.text}
    </ReactMarkdown>
  );
}
