import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppShell } from "@/shell/AppShell";
import AboutPage from "@/pages/AboutPage";
import "@/styles/globals.css";
import "@/styles/cta-elevation.css";
import "@/styles/ds.css";
import "@/styles/workbench-b7.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppShell>
      <AboutPage />
    </AppShell>
  </StrictMode>,
);
