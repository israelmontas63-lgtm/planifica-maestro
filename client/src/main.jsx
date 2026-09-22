import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./index.css";
import { registerSW } from 'virtual:pwa-register';

if ("serviceWorker" in navigator) {
  registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      
      let lastCheck = 0;
      const check = () => {
        const now = Date.now();
        if (now - lastCheck >= 60000) {
          lastCheck = now;
          registration.update().catch(() => {});
        }
      };
      
      // Comprobar al abrir
      check();
      // Comprobar al volver a la app (visibilitychange)
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });
      window.addEventListener("focus", check);
      window.addEventListener("online", check);
      // Comprobar cada 30 minutos
      setInterval(check, 30 * 60 * 1000);
    },
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary><App /></ErrorBoundary>
  </React.StrictMode>
);


