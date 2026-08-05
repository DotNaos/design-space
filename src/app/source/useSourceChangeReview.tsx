import { useCallback, useEffect, useMemo, useState } from "react";

import type { ComponentDesignDefinition } from "../../shared/component-design";
import type { RuntimeSourceWorkspace, SourceWorkspaceLayer } from "../../shared/source-workspace";
import { runLocalOperation } from "../api";
import { SourcePreviewFrame } from "./SourcePreviewFrame";
import { preparedSourceDraftModuleUrl } from "./source-draft-local";
import { applySourceDraftChanges, SourceChangeApplyError } from "./source-change-apply";
import type { SourceChangeReviewItem, SourceChangeReviewState } from "./source-change-review";
import type { SourceDraftEntry, SourceDraftWorkspaceStore } from "./source-draft-workspace";
import { sourceDraftGroupId } from "./source-draft-workspace";
import { findSourceTreeLayer } from "./source-workspace-tree";
import { ReviewSourcePreview } from "./ReviewSourcePreview";
import { ReviewPreviewUnavailable } from "./ReviewPreviewUnavailable";

type VisualReviewContext = {
  currentFileId?: string;
  css: string;
  layer?: SourceWorkspaceLayer;
  textValue: string;
  value: string;
};

export type SourceChangeReviewOptions = {
  appLabel: string;
  appVisual: VisualReviewContext;
  appWorkspace: RuntimeSourceWorkspace;
  changes: readonly SourceDraftEntry[];
  draftWorkspace: SourceDraftWorkspaceStore;
  libraryLabel: string;
  libraryVisual: VisualReviewContext;
  libraryWorkspace: RuntimeSourceWorkspace;
};

export function useSourceChangeReview(options: SourceChangeReviewOptions) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<SourceChangeReviewState>({});
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string>();
  const items = useMemo<readonly SourceChangeReviewItem[]>(() => options.changes.map((change) => {
    const workspace = change.scope === "app" ? options.appWorkspace : options.libraryWorkspace;
    const sourceEntry = workspace.entries.find((candidate) => (
      candidate.fileId === change.fileId || candidate.design?.fileId === change.fileId
    ));
    const liveVisual = change.scope === "app" ? options.appVisual : options.libraryVisual;
    const storedVisual = change.visualReview;
    const previewEntry = storedVisual?.previewEntryId
      ? workspace.entries.find((candidate) => candidate.id === storedVisual.previewEntryId) ?? sourceEntry
      : sourceEntry;
    const visualLayer = storedVisual
      ? findSourceTreeLayer(sourceEntry?.layers, storedVisual.layerId)
      : change.fileId === liveVisual.currentFileId ? liveVisual.layer : undefined;
    const valid = change.stale.state === "current" && change.validation.state === "valid";
    const preview = (after: boolean) => previewEntry ? (
      after
        ? (
          <PreparedReviewPreview
            change={change}
            changes={options.changes}
            entry={previewEntry}
            entries={workspace.entries}
            layer={visualLayer}
            runtime={workspace.runtime}
            styles={workspace.styles}
            valid={valid}
          />
        )
        : (
          <div className="h-52 w-full min-w-0 overflow-hidden">
            <SourcePreviewFrame
              centerContent
              compact
              device={previewEntry.device}
              entry={previewEntry}
              entries={workspace.entries}
              runtime={workspace.runtime}
              isolateSelectedLayer={false}
              showChrome={false}
              selectedLayer={visualLayer}
              styles={workspace.styles}
              onDeviceChange={() => undefined}
            />
          </div>
        )
    ) : <ReviewPreviewUnavailable message="No isolated component design is registered for this file." />;
    return {
      id: change.key,
      digest: change.draftDigest,
      label: sourceEntry?.label ?? change.label.split("/").at(-1) ?? change.label,
      path: change.path,
      repository: change.scope === "app" ? options.appLabel : options.libraryLabel,
      valid,
      ...(valid ? {} : { validationMessage: change.stale.state === "stale"
        ? change.stale.message ?? "The source changed after this draft was opened."
        : change.validation.message ?? (change.validation.state === "validating"
          ? "This draft is still being validated."
          : "Validate this draft before approving it.") }),
      defaultIncluded: change.selectedForReview,
      before: { preview: preview(false), source: change.baseSource },
      after: { preview: preview(true), source: change.draftSource },
    };
  }), [options]);

  const synchronize = useCallback((next: SourceChangeReviewState) => {
    setState(next);
    const changedGroups = new Set<string>();
    for (const change of options.changes) {
      const review = next[change.key];
      if (!review || review.digest !== change.draftDigest) continue;
      if (review.included !== change.selectedForReview) {
        options.draftWorkspace.setSelectedForReview(change, review.included);
        changedGroups.add(sourceDraftGroupId(change));
      }
      if (review.approved !== change.approved) options.draftWorkspace.approve(change, review.approved);
    }
    if (changedGroups.size) void prepareSelectedDraftGroups(options.draftWorkspace, changedGroups);
  }, [options.changes, options.draftWorkspace]);

  const show = useCallback(() => {
    setError(undefined);
    setState(Object.fromEntries(options.changes.map((change) => [change.key, {
      approved: change.approved,
      digest: change.draftDigest,
      included: change.selectedForReview,
    }])));
    setOpen(true);
    void prepareSelectedDraftGroups(options.draftWorkspace);
  }, [options.changes, options.draftWorkspace]);

  const acceptApplied = useCallback((
    results: Awaited<ReturnType<typeof applySourceDraftChanges>>,
    changes: readonly SourceDraftEntry[],
  ) => {
    for (const result of results) {
      for (const applied of result.changes) {
        const change = changes.find((candidate) => (
          candidate.scope === result.scope && candidate.fileId === applied.fileId
        ));
        if (change) options.draftWorkspace.acceptApplied(change, {
          expectedBaseVersion: change.baseVersion,
          expectedDraftDigest: change.draftDigest,
          source: change.draftSource,
          version: applied.version,
        });
      }
    }
  }, [options.draftWorkspace]);

  const apply = useCallback(async (selected: readonly SourceChangeReviewItem[]) => {
    const resolved = resolveCurrentReviewedDrafts(options.draftWorkspace, selected);
    if (resolved.error) {
      setError(resolved.error);
      return;
    }
    const changes = resolved.changes;
    if (!changes.length) return;
    setApplying(true);
    setError(undefined);
    try {
      const results = await applySourceDraftChanges(changes, (operation) => runLocalOperation(operation));
      acceptApplied(results, changes);
      await options.draftWorkspace.flush();
      setOpen(false);
      setState({});
    } catch (reason) {
      const completed = reason instanceof SourceChangeApplyError ? reason.applied : [];
      acceptApplied(completed, changes);
      const message = reason instanceof Error ? reason.message : "The reviewed source changes could not be applied.";
      const applied = new Set(completed.flatMap((result) => (
        result.changes.map((change) => `${result.scope}:${change.fileId}`)
      )));
      for (const change of changes) {
        if (!applied.has(`${change.scope}:${change.fileId}`)) {
          const current = options.draftWorkspace.getSnapshot().changes.find((candidate) => candidate.key === change.key);
          if (current?.draftDigest === change.draftDigest) {
            options.draftWorkspace.setValidation(change, "invalid", message);
          }
        }
      }
      setError(message);
    } finally {
      setApplying(false);
    }
  }, [acceptApplied, options.draftWorkspace]);

  const discard = useCallback((id: string) => {
    const reviewed = items.find((item) => item.id === id);
    const current = options.draftWorkspace.getSnapshot().changes.find((candidate) => candidate.key === id);
    if (!reviewed || !current) return;
    if (current.draftDigest !== reviewed.digest) {
      setError(`This review is out of date. ${reviewed.label} changed after it opened, so the newer draft was kept.`);
      return;
    }
    setError(undefined);
    options.draftWorkspace.remove(current);
  }, [items, options.draftWorkspace]);

  return {
    applying,
    apply,
    close: () => setOpen(false),
    discard,
    error,
    items,
    open,
    show,
    state,
    synchronize,
  };
}

function resolveCurrentReviewedDrafts(
  workspace: SourceDraftWorkspaceStore,
  reviewed: readonly SourceChangeReviewItem[],
): { changes: readonly SourceDraftEntry[]; error?: string } {
  const current = new Map(workspace.getSnapshot().changes.map((change) => [change.key, change]));
  const changes: SourceDraftEntry[] = [];
  for (const item of reviewed) {
    const change = current.get(item.id);
    const ready = change
      && change.draftDigest === item.digest
      && change.selectedForReview
      && change.approved
      && change.stale.state === "current"
      && change.validation.state === "valid"
      && change.validation.draftDigest === change.draftDigest;
    if (!ready) {
      return {
        changes: [],
        error: `This review is out of date. ${item.label} changed or is no longer approved and valid. Review the latest draft before applying.`,
      };
    }
    changes.push(change);
  }
  return { changes };
}

export async function prepareSelectedDraftGroups(
  workspace: SourceDraftWorkspaceStore,
  onlyGroups?: ReadonlySet<string>,
): Promise<void> {
  const groups = new Map<string, SourceDraftEntry[]>();
  for (const change of workspace.getSnapshot().changes) {
    if (!change.selectedForReview) continue;
    const id = sourceDraftGroupId(change);
    if (onlyGroups && !onlyGroups.has(id)) continue;
    groups.set(id, [...(groups.get(id) ?? []), change]);
  }
  await Promise.all([...groups.values()].map((changes) => workspace.prepareGroup(changes)));
}

function PreparedReviewPreview(props: {
  change: SourceDraftEntry;
  changes: readonly SourceDraftEntry[];
  entry: RuntimeSourceWorkspace["entries"][number];
  entries: RuntimeSourceWorkspace["entries"];
  layer?: SourceWorkspaceLayer;
  runtime: RuntimeSourceWorkspace["runtime"];
  styles: readonly string[];
  valid: boolean;
}) {
  const visualReview = props.change.visualReview;
  const designFileId = props.entry.design?.fileId;
  const moduleUrl = props.valid && designFileId
    ? preparedSourceDraftModuleUrl(
      props.change,
      designFileId,
      props.entry.design!.relativePath,
      props.changes,
    )
    : undefined;
  const [loaded, setLoaded] = useState<{ digest: string; definition: ComponentDesignDefinition }>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!moduleUrl) {
      setLoaded(undefined);
      setError(undefined);
      return;
    }
    let active = true;
    void import(/* @vite-ignore */ moduleUrl).then((module: { default?: ComponentDesignDefinition }) => {
      if (!active) return;
      if (!module.default) throw new Error("The prepared design module has no default export.");
      setLoaded({ digest: props.change.draftDigest, definition: module.default });
      setError(undefined);
    }).catch((reason: unknown) => {
      if (!active) return;
      setLoaded(undefined);
      setError(reason instanceof Error ? reason.message : "The prepared design could not be executed.");
    });
    return () => { active = false; };
  }, [moduleUrl, props.change.draftDigest]);

  if (!designFileId) {
    return <ReviewPreviewUnavailable message="No isolated component design is registered for this source file." />;
  }
  if (!props.valid) {
    return visualReview ? (
      <ReviewSourcePreview
        change={props.change}
        entries={props.entries}
        entry={props.entry}
        layer={props.layer}
        runtime={props.runtime}
        styles={props.styles}
      />
    ) : <ReviewPreviewUnavailable message="This invalid code draft cannot be executed safely. The source diff remains available below." />;
  }
  if (!moduleUrl) {
    return <ReviewPreviewUnavailable message="The prepared preview is unavailable. The source comparison below remains authoritative." />;
  }
  if (error) {
    return <ReviewPreviewUnavailable message={`The prepared preview could not run: ${error}`} />;
  }
  if (loaded?.digest !== props.change.draftDigest) {
    return <ReviewPreviewUnavailable message="Loading the validated after preview…" />;
  }
  const preparedEntry = {
    ...props.entry,
    design: { ...props.entry.design!, load: async () => loaded.definition },
  };
  return <ReviewSourcePreview {...props} entry={preparedEntry} />;
}
