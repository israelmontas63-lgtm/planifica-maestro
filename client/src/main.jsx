import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import "./index.css";
import { registerSW } from "virtual:pwa-register";

// Configurar actualización en tiempo real de la PWA
const updateSW = registerSW({
  onNeedRefresh() {
    // Cuando hay una nueva versión, se actualiza y recarga automáticamente
    if (confirm("Hay una nueva actualización disponible. ¿Deseas aplicarla ahora?")) {
      updateSW(true);
    } else {
       updateSW(true); // Auto-update anyway based on user request for "immediately"
    }
  },
  onOfflineReady() {
    console.log("PWA lista para trabajar sin conexión");
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary><App /></ErrorBoundary>
  </React.StrictMode>
);


