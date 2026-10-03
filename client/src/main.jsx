import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./index.css";
import { initPWA } from "./services/pwaManager.js";

// Inicializar el orquestador del ciclo de vida de la PWA
initPWA({
  isBusy: () => {
    return typeof window !== "undefined" && window.__PM_PWA__?.isBusy?.();
  },
  saveDraft: () => {
    if (typeof window !== "undefined" && window.__PM_PWA__?.saveDraft) {
      window.__PM_PWA__.saveDraft();
    }
  },
  onUpdatePending: (reloadFn) => {
    if (typeof window !== "undefined") {
      window.__PM_PENDING_RELOAD__ = reloadFn;
      window.dispatchEvent(new CustomEvent("pm:update-pending"));
    }
  }
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary><App /></ErrorBoundary>
  </React.StrictMode>
);


