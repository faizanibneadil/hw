import { GraduationCapIcon } from "lucide-react";

/** Shown in a new chat before the first message. */
export function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="rounded-full border p-3 text-muted-foreground">
        <GraduationCapIcon className="size-6" aria-hidden />
      </div>
      <h1 className="text-lg font-semibold">Check a homework</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Attach the student&apos;s code files or paste the code in a code block, then write what to check and how many marks
        each item is worth.
      </p>
    </div>
  );
}
