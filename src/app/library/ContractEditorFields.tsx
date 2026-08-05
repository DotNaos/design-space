
import { ContractTextInput } from "./ContractTextInput";
import { ContractTextArea } from "./ContractTextArea";
import { OptionalNumberInput } from "./OptionalNumberInput";
import { ContractSwitch } from "./ContractSwitch";
import { ContractSelect } from "./ContractSelect";

export const inputClassName = "mt-1 min-h-11 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-base text-zinc-200 outline-none placeholder:text-zinc-700 lg:text-sm";

export function StableIdField(props: { id: string }) {
  return (
    <div>
      <p className="text-[10px] text-zinc-500">Stable ID</p>
      <code className="mt-1 block min-h-10 break-all rounded-lg border border-white/5 bg-black/20 px-3 py-2 font-mono text-xs leading-5 text-emerald-400/80">
        {props.id}
      </code>
      <p className="mt-1 text-[9px] leading-4 text-zinc-600">Referenced by saved documents and cannot be changed.</p>
    </div>
  );
}

export { ContractTextInput } from "./ContractTextInput";
export { ContractTextArea } from "./ContractTextArea";
export { OptionalNumberInput } from "./OptionalNumberInput";
export { ContractSwitch } from "./ContractSwitch";
export { ContractSelect } from "./ContractSelect";
