

export function ReviewPreviewUnavailable(props: { message: string }) {
  return (
    <div className="grid min-h-32 w-full place-items-center px-5 text-center text-[10px] leading-5 text-zinc-600">
      {props.message}
    </div>
  );
}
