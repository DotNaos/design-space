import { MessageSquareText } from "lucide-react";

import {
  type SourceFeedbackContext,
  useSourceFeedbackAnnotations,
} from "./source-feedback";

export function SourceFeedbackInspector(props: {
  context?: SourceFeedbackContext;
}) {
  const comments = useSourceFeedbackAnnotations(props.context?.id);
  if (!props.context || comments.length === 0) return null;
  return (
    <section aria-label="Comments" className="border-b border-white/10 px-4 py-3">
      <header className="flex items-center gap-2 text-violet-300">
        <MessageSquareText aria-hidden="true" size={14} />
        <h3 className="text-[10px] font-medium">Comments</h3>
        <span className="ml-auto text-[9px] tabular-nums text-zinc-600">{comments.length}</span>
      </header>
      <ul className="mt-2 space-y-2">
        {comments.slice(0, 5).map((comment) => (
          <li key={comment.id} className="border-l border-violet-400/30 pl-2">
            <p className="text-[10px] leading-4 text-zinc-300">{comment.comment}</p>
            <time className="mt-0.5 block text-[8px] text-zinc-700" dateTime={comment.createdAt}>
              {new Date(comment.createdAt).toLocaleString()}
            </time>
          </li>
        ))}
      </ul>
    </section>
  );
}
