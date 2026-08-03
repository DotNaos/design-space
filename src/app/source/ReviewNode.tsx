

export function ReviewNode(props: {
  children: React.ReactNode;
  className: string;
  eyebrow: string;
  label: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`pointer-events-auto z-10 overflow-hidden rounded-xl bg-[#15161a] shadow-[0_8px_24px_rgba(0,0,0,0.22)] ${props.className}`}
      data-design-space-canvas-chrome
      style={props.style}
    >
      <header className="flex h-7 items-center gap-2 border-b border-white/[0.07] px-2.5">
        <span className="text-[9px] font-medium text-sky-300/75">{props.eyebrow}</span>
        <span className="text-[10px] font-medium text-zinc-200">{props.label}</span>
      </header>
      {props.children}
    </div>
  );
}
