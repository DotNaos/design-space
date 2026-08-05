
import { PackageCheck } from "lucide-react";

export function LibraryState(props: { message: string; title: string }) {
  return (
    <div className="grid h-full min-h-0 w-full min-w-0 flex-1 place-items-center bg-[#0d0e10] p-8 text-center">
      <div className="max-w-sm"><PackageCheck className="mx-auto text-zinc-700" size={22} /><h2 className="mt-3 text-sm font-semibold text-zinc-300">{props.title}</h2><p className="mt-2 text-xs leading-5 text-zinc-600">{props.message}</p></div>
    </div>
  );
}
