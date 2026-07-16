import { useEffect, useState } from "react";
import { Button, Input, Label, Modal, TextField } from "@heroui/react";
import { Component, LoaderCircle, X } from "lucide-react";
import { SelfHostingBadge } from "../components/SelfHostingBadge";

const validComponentName = /^[A-Z][A-Za-z0-9]{1,63}$/;

export function SourceComponentCreateSheet(props: {
  open: boolean;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onPrepare: (name: string) => void;
}) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (props.open) setName("");
  }, [props.open]);

  const valid = validComponentName.test(name.trim()) && !props.busy;
  return (
    <Modal.Backdrop isOpen={props.open} onOpenChange={(open) => { if (!open && !props.busy) props.onClose(); }} variant="blur">
      <Modal.Container className="items-end p-0 lg:p-4" placement="bottom" size="md">
        <Modal.Dialog aria-label="Create component" className="w-full rounded-b-none border border-white/10 bg-[#17181b] text-zinc-200 lg:rounded-xl">
          <Modal.Header className="border-b border-white/10 px-4 py-3">
            <div className="flex w-full items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-sky-500/10 text-sky-300"><Component size={17} /></span>
              <div className="min-w-0 flex-1">
                <SelfHostingBadge label="TypeScript source" />
                <Modal.Heading className="mt-0.5 text-base font-semibold">Create component</Modal.Heading>
              </div>
              <Button aria-label="Close create component" isIconOnly className="size-11" isDisabled={props.busy} size="sm" variant="ghost" onPress={props.onClose}><X size={16} /></Button>
            </div>
          </Modal.Header>
          <Modal.Body className="p-4">
            <TextField fullWidth value={name} onChange={setName}>
              <Label className="text-xs text-zinc-400">Component name</Label>
              <Input autoFocus className="mt-1 min-h-12 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-base text-zinc-100 outline-none" placeholder="StatusBadge" />
            </TextField>
            <p className="mt-2 text-[10px] leading-5 text-zinc-500">
              Use PascalCase. Design Space creates one component folder and derives its props and children slot from TypeScript.
            </p>
            {name.trim() && !validComponentName.test(name.trim()) && (
              <p className="mt-2 text-xs text-amber-300">Start with a capital letter and use letters or numbers only.</p>
            )}
            {props.error && <p className="mt-4 bg-rose-500/10 px-3 py-2 text-xs leading-5 text-rose-300" role="alert">{props.error}</p>}
          </Modal.Body>
          <footer className="grid grid-cols-2 gap-2 border-t border-white/10 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
            <Button className="min-h-11" isDisabled={props.busy} variant="secondary" onPress={props.onClose}>Cancel</Button>
            <Button className="min-h-11" isDisabled={!valid} onPress={() => props.onPrepare(name.trim())}>
              {props.busy ? <><LoaderCircle className="animate-spin" size={15} /> Checking…</> : "Review source"}
            </Button>
          </footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
