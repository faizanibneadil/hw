"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { getCollections, type Collections } from "@/lib/db/collections";

const DbContext = createContext<Collections | null>(null);

type DbState = { status: "loading" } | { status: "ready"; collections: Collections } | { status: "error"; message: string };

/** Opens IndexedDB and provides the TanStack DB collections to the tree. */
export function DbProvider({ children, fallback }: { children: ReactNode; fallback: (state: DbState) => ReactNode }) {
  const [state, setState] = useState<DbState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getCollections().then(
      (collections) => !cancelled && setState({ status: "ready", collections }),
      (error: unknown) =>
        !cancelled &&
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Could not open the local database.",
        }),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status !== "ready") return <>{fallback(state)}</>;
  return <DbContext.Provider value={state.collections}>{children}</DbContext.Provider>;
}

export function useCollections(): Collections {
  const collections = useContext(DbContext);
  if (!collections) throw new Error("useCollections must be used inside <DbProvider>");
  return collections;
}

export type { DbState };
