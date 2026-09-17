import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import "./index.css";
import { registerSW } from "virtual:pwa-register";

// Configurar actualización automática en tiempo real de la PWA
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log("Planifica Maestro: Nueva versión detectada, actualizando PWA...");
    updateSW(true);
  },
  onOfflineReady() {
    console.log("Planifica Maestro: PWA lista para operar sin conexión.");
  },
  onRegisteredSW(_swScriptUrl, registration) {
    if (registration) {
      // Comprobación periódica de nueva versión cada 30 minutos
      setInterval(() => {
        registration.update();
      }, 30 * 60 * 1000);

      // Comprobar actualización al volver a la ventana o recuperar conexión
      window.addEventListener("focus", () => registration.update());
      window.addEventListener("online", () => registration.update());
    }
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary><App /></ErrorBoundary>
  </React.StrictMode>
);


