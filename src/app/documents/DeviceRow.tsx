

export function DeviceRow(props: { icon: React.ReactNode; label: string }) {
  return <div className="flex min-h-10 items-center gap-2 px-2 text-xs text-zinc-500"><span className="w-[13px]" />{props.icon}<span>{props.label}</span><span className="ml-auto text-[9px] text-zinc-700">Not configured</span></div>;
}
