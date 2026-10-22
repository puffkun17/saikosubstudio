import { useSyncExternalStore } from "react";

const subscribe = (onStoreChange: () => void) => {
  window.addEventListener("popstate", onStoreChange);
  return () => window.removeEventListener("popstate", onStoreChange);
};

const getSnapshot = () => window.location.pathname;
const getServerSnapshot = () => "/";

/** Tiny pathname hook for MPA (replaces next/navigation usePathname). */
export function useLocationPathname(): string {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
