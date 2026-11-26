export function ThinkingIndicator() {
  return (
    <div role="status" className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-current" />
      <span className="sr-only">Checking the code…</span>
    </div>
  );
}
