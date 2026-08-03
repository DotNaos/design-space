import { ListBox } from "@heroui/react";
import { Check, PackageCheck } from "lucide-react";

import type { LibraryReleaseVersion } from "../../shared/source-workspace";

export function LibraryReleaseVersionItem(props: {
  currentVersion?: string;
  entry: LibraryReleaseVersion;
  latestVersion?: string;
}) {
  const current = props.entry.version === props.currentVersion;
  const latest = props.entry.version === props.latestVersion;
  return (
    <ListBox.Item
      className="flex min-h-9 cursor-default items-center gap-2 rounded-xl px-2.5 text-[10px] text-zinc-300 outline-none data-[focused]:bg-white/[0.07] data-[selected]:bg-violet-500/[0.12] data-[selected]:text-violet-200"
      id={props.entry.version}
      textValue={props.entry.version}
    >
      <PackageCheck className="size-3 shrink-0 text-zinc-600" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="font-medium">{props.entry.version}</span>
          {latest ? <span className="rounded-full bg-sky-400/[0.12] px-1.5 py-0.5 text-[7px] text-sky-300">Latest</span> : null}
          {props.entry.deprecated ? <span className="rounded-full bg-amber-400/[0.12] px-1.5 py-0.5 text-[7px] text-amber-300">Deprecated</span> : null}
        </span>
        {props.entry.publishedAt ? (
          <span className="mt-0.5 block text-[8px] text-zinc-600">{formatPublishedAt(props.entry.publishedAt)}</span>
        ) : null}
      </span>
      {current ? <Check className="size-3 shrink-0 text-violet-300" /> : null}
    </ListBox.Item>
  );
}

function formatPublishedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}
