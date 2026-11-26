import type { DbState } from "@/lib/db/db-context";

/** Shown for the few milliseconds IndexedDB takes to open, or if it cannot be opened. */
export function DbStatus({ state }: { state: DbState }) {
  if (state.status === "error") {
    return (
      <div role="alert" className="flex h-dvh items-center justify-center p-6 text-center text-sm">
        <p>
          Could not open the browser database ({state.message}). hw needs IndexedDB; private windows in some browsers
          block it.
        </p>
      </div>
    );
  }
  return <div className="h-dvh bg-background" aria-busy="true" />;
}
