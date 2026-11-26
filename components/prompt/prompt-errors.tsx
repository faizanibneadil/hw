import { CircleAlertIcon, XIcon } from "lucide-react";

interface PromptErrorsProps {
  errors: string[];
  onDismiss: () => void;
}

/** Inline, dismissible list of input errors (file validation, missing code, ...). */
export function PromptErrors({ errors, onDismiss }: PromptErrorsProps) {
  if (!errors.length) return null;
  return (
    <div
      role="alert"
      className="mb-2 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive-text"
    >
      <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <ul className="min-w-0 flex-1 space-y-0.5">
        {errors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
      <button
        type="button"
        aria-label="Dismiss errors"
        onClick={onDismiss}
        className="rounded-sm p-0.5 outline-none hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <XIcon className="size-3.5" />
      </button>
    </div>
  );
}
