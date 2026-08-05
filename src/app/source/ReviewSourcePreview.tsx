
import type { RuntimeSourceWorkspace, SourceWorkspaceLayer } from "../../shared/source-workspace";
import { SourcePreviewFrame } from "./SourcePreviewFrame";
import type { SourceDraftEntry } from "./source-draft-workspace";

export function ReviewSourcePreview(props: {
  change: SourceDraftEntry;
  entries: RuntimeSourceWorkspace["entries"];
  entry: RuntimeSourceWorkspace["entries"][number];
  layer?: SourceWorkspaceLayer;
  runtime: RuntimeSourceWorkspace["runtime"];
  styles: readonly string[];
}) {
  return (
    <div className="h-52 w-full min-w-0 overflow-hidden">
      <SourcePreviewFrame
        centerContent
        compact
        device={props.entry.device}
        entry={props.entry}
        entries={props.entries}
        runtime={props.runtime}
        isolateSelectedLayer={false}
        showChrome={false}
        selectedLayer={props.layer}
        selectedClassName={props.change.visualReview?.className}
        selectedText={props.change.visualReview?.text}
        styles={[
          ...props.styles,
          ...(props.change.visualReview?.css ? [props.change.visualReview.css] : []),
        ]}
        onDeviceChange={() => undefined}
      />
    </div>
  );
}
