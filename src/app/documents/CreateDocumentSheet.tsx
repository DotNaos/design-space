import { useEffect, useMemo, useState } from "react";
import { Button, Input, Label, Modal, TextField } from "@heroui/react";
import { Boxes, FilePlus2, LoaderCircle, Smartphone, X } from "lucide-react";

import type { DocumentCreationRecipeEntry } from "../../shared/document-transactions";
import type { ProductMode } from "./DocumentNavigator";

export function CreateDocumentSheet(props: {
  open: boolean;
  mode: ProductMode;
  recipes: readonly DocumentCreationRecipeEntry[];
  busy: boolean;
  error?: string;
  onClose: () => void;
  onPrepare: (recipeId: string, label: string) => void;
}) {
  const recipes = useMemo(() => {
    const kind = props.mode === "app" ? "screen" : "component";
    return props.recipes.filter((recipe) => recipe.kind === kind);
  }, [props.mode, props.recipes]);
  const [label, setLabel] = useState("");
  const [recipeId, setRecipeId] = useState("");

  useEffect(() => {
    if (!props.open) return;
    setLabel("");
    setRecipeId(recipes[0]?.id ?? "");
  }, [props.open, props.mode]);

  const kindLabel = props.mode === "app" ? "screen" : "component";
  const valid = Boolean(label.trim() && recipeId && !props.busy);

  return (
    <Modal.Backdrop isOpen={props.open} onOpenChange={(open) => { if (!open && !props.busy) props.onClose(); }} variant="blur">
      <Modal.Container className="items-end p-0 lg:p-4" placement="bottom" size="md">
        <Modal.Dialog aria-label={`Create ${kindLabel}`} className="max-h-[82dvh] w-full rounded-b-none border border-white/10 bg-[#17181b] text-zinc-200 lg:rounded-xl">
          <Modal.Header className="border-b border-white/10 px-4 py-3">
            <div className="flex w-full items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-sky-500/10 text-sky-300"><FilePlus2 size={17} /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] uppercase tracking-[0.16em] text-zinc-500">Target-owned recipe</p>
                <Modal.Heading className="mt-0.5 text-base font-semibold">Create {kindLabel}</Modal.Heading>
              </div>
              <Button aria-label={`Close create ${kindLabel}`} isIconOnly className="size-11" isDisabled={props.busy} size="sm" variant="ghost" onPress={props.onClose}><X size={16} /></Button>
            </div>
          </Modal.Header>
          <Modal.Body className="min-h-0 overflow-y-auto p-4">
            <TextField fullWidth value={label} onChange={setLabel}>
              <Label className="text-xs text-zinc-400">Name</Label>
              <Input autoFocus className="mt-1 min-h-12 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-base text-zinc-100 outline-none" placeholder={props.mode === "app" ? "Settings" : "Profile card"} />
            </TextField>

            <fieldset className="mt-5">
              <legend className="mb-2 text-xs font-medium text-zinc-400">Starting structure</legend>
              <div className="divide-y divide-white/5 border-y border-white/10">
                {recipes.map((recipe) => {
                  const selected = recipe.id === recipeId;
                  return (
                    <button
                      key={recipe.id}
                      aria-pressed={selected}
                      className={`flex min-h-16 w-full items-start gap-3 px-2 py-3 text-left ${selected ? "bg-sky-500/10" : "hover:bg-white/[0.03]"}`}
                      type="button"
                      onClick={() => setRecipeId(recipe.id)}
                    >
                      <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ${selected ? "bg-sky-500 text-white" : "bg-white/5 text-zinc-500"}`}>
                        {recipe.kind === "screen" ? <Smartphone size={15} /> : <Boxes size={15} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-zinc-100">{recipe.label}</span>
                        {recipe.description && <span className="mt-1 block text-xs leading-5 text-zinc-500">{recipe.description}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
              {!recipes.length && <p className="py-6 text-center text-xs leading-5 text-zinc-500">This target has not registered a {kindLabel} recipe.</p>}
            </fieldset>

            {props.error && <p className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-xs leading-5 text-rose-300" role="alert">{props.error}</p>}
          </Modal.Body>
          <footer className="grid grid-cols-2 gap-2 border-t border-white/10 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
            <Button className="min-h-11" isDisabled={props.busy} variant="secondary" onPress={props.onClose}>Cancel</Button>
            <Button className="min-h-11" isDisabled={!valid} onPress={() => props.onPrepare(recipeId, label.trim())}>
              {props.busy ? <><LoaderCircle className="animate-spin" size={15} /> Checking…</> : "Review source"}
            </Button>
          </footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
