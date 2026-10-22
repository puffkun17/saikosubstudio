import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppShell } from "@/shell/AppShell";
import FeedbackPage from "@/pages/FeedbackPage";
import "@/styles/globals.css";
import "@/styles/cta-elevation.css";
import "@/styles/ds.css";
import "@/styles/workbench-b7.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppShell>
      <FeedbackPage />
    </AppShell>
  </StrictMode>,
);
