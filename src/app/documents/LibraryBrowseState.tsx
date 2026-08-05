
import { Library } from "lucide-react";

export function LibraryBrowseState(props: { label?: string; readOnly: boolean }) {
  return (
    <section aria-label="Library selection" className="grid h-full w-full place-items-center bg-[#0d0e10] px-6 text-center">
      <div className="max-w-72">
        <Library aria-hidden="true" className="mx-auto mb-3 text-zinc-600" size={24} />
        <h2 className="text-sm font-semibold text-zinc-200">{props.label ?? "Component library"}</h2>
        <p className="mt-2 text-[11px] leading-5 text-zinc-500">
          {props.label
            ? props.readOnly
              ? "This target component is available to the app and stays read-only here."
              : "Open this project component to continue editing it in the App workspace."
            : "Select a component to inspect its source and access level."}
        </p>
      </div>
    </section>
  );
}
