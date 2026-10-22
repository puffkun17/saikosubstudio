import type { ReactNode } from "react";
import { SystemTray } from "@/components/Global/SystemTray";
import { AppChrome } from "@/components/Global/AppChrome";
import { ServiceWorkerUpdate } from "@/components/Global/ServiceWorkerUpdate";

/** Shared chrome previously provided by app/layout.tsx. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AppChrome>
      <SystemTray />
      <div className="app-main-pad">{children}</div>
      <ServiceWorkerUpdate />
    </AppChrome>
  );
}
