import { Button, Modal } from "@heroui/react";
import { GitBranch, LoaderCircle, RefreshCw } from "lucide-react";

interface LibraryBranchReloadDialogProps {
  branch?: string;
  createsWorktree: boolean;
  busy: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function LibraryBranchReloadDialog(props: LibraryBranchReloadDialogProps) {
  return (
    <Modal.Backdrop
      isOpen={Boolean(props.branch)}
      onOpenChange={(open) => { if (!open && !props.busy) props.onCancel(); }}
      variant="blur"
    >
      <Modal.Container className="p-3" placement="center" size="sm">
        <Modal.Dialog aria-label="Switch library branch" className="w-full rounded-xl bg-[#17181b] text-zinc-200">
          <Modal.Header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-violet-300">
              <GitBranch aria-hidden="true" size={15} />
            </span>
            <div className="min-w-0">
              <Modal.Heading className="text-sm font-semibold text-zinc-100">Switch library branch?</Modal.Heading>
              <p className="mt-0.5 truncate font-mono text-[10px] text-zinc-500">{props.branch}</p>
            </div>
          </Modal.Header>
          <Modal.Body className="space-y-2 px-4 py-4 text-[11px] leading-relaxed text-zinc-400">
            <p>Design Space will reload the library sources and rebuild the component workspace.</p>
            {props.createsWorktree ? (
              <p>A dedicated worktree will be created and its dependencies installed first. The existing checkout stays unchanged.</p>
            ) : (
              <p>The existing branch worktree will be reused. The existing checkout stays unchanged.</p>
            )}
            {props.error ? (
              <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-rose-300" role="alert">
                {props.error}
              </p>
            ) : null}
          </Modal.Body>
          <Modal.Footer className="flex justify-end gap-2 border-t border-white/10 px-4 py-3">
            <Button
              className="h-8 rounded-full bg-white/[0.055] px-3 text-[10px] text-zinc-300 hover:bg-white/[0.09]"
              isDisabled={props.busy}
              size="sm"
              variant="ghost"
              onPress={props.onCancel}
            >
              Cancel
            </Button>
            <Button
              className="h-8 gap-1.5 rounded-full bg-violet-500 px-3 text-[10px] font-semibold text-white hover:bg-violet-400"
              isDisabled={props.busy}
              size="sm"
              onPress={props.onConfirm}
            >
              {props.busy ? <LoaderCircle className="animate-spin" size={12} /> : <RefreshCw size={12} />}
              Switch and reload
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
