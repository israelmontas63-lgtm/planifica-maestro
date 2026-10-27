import { useState, useEffect } from "react";

export default function AcercaModal({ onCerrar, onAplicarActualizacion }) {
  const [versionData, setVersionData] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [mensajeActualizacion, setMensajeActualizacion] = useState(null);
  const [hayNuevaVersion, setHayNuevaVersion] = useState(false);

  useEffect(() => {
    let cancelado = false;
    async function cargarVersion() {
      try {
        const res = await fetch("/version.json", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (!cancelado) setVersionData(data);
        }
      } catch (e) {
        console.warn("No se pudo obtener version.json:", e);
      } finally {
        if (!cancelado) setCargando(false);
      }
    }
    cargarVersion();
    return () => { cancelado = true; };
  }, []);

  async function handleBuscarActualizacion() {
    setBuscando(true);
    setMensajeActualizacion(null);
    setHayNuevaVersion(false);

    try {
      // 1. Invocar update() en el Service Worker si está soportado
      let swWaiting = false;
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update().catch(() => {});
          if (reg.waiting || reg.installing) {
            swWaiting = true;
          }
        }
      }

      // 2. Consultar directamente version.json sin caché
      const res = await fetch("/version.json", { cache: "no-store" });
      if (res.ok) {
        const remoteData = await res.json();
        const currentCommit = versionData?.commit || (typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : null);
        const remoteCommit = remoteData.commit;

        // Si el commit remoto difiere del actual o el Service Worker tiene worker esperando
        if (swWaiting || (currentCommit && remoteCommit && currentCommit !== remoteCommit)) {
          setHayNuevaVersion(true);
          setMensajeActualizacion("¡Hay una nueva versión disponible con mejoras curriculares!");
          setVersionData(remoteData);
        } else {
          setMensajeActualizacion("Tienes la última versión instalada.");
          setVersionData(remoteData);
        }
      } else {
        setMensajeActualizacion("No se pudo conectar con el servidor para verificar actualizaciones.");
      }
    } catch (err) {
      setMensajeActualizacion("Error verificando actualizaciones: " + (err.message || "Falla de red"));
    } finally {
      setBuscando(false);
    }
  }

  function handleRecargarApp() {
    window.location.reload();
  }

  return (
    <div className="schema-overlay" onClick={onCerrar} style={{ zIndex: 1200 }}>
      <div className="schema-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "480px" }}>
        
        <div className="schema-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "24px" }}>ℹ️</span>
            <div>
              <h2 style={{ margin: 0, fontSize: "18px" }}>Acerca de y Actualización</h2>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "rgba(255,255,255,0.85)" }}>
                Información del sistema y control de versiones PWA
              </p>
            </div>
          </div>
          <button className="schema-close-btn" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </div>

        <div style={{ padding: "18px", display: "flex", flexDirection: "column", gap: "14px" }}>
          
          {/* Tarjeta de información de la versión */}
          <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: "12px", padding: "14px" }}>
            <h4 style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#1e293b", display: "flex", alignItems: "center", gap: "6px" }}>
              <span>📦</span> Versión Instalada
            </h4>
            
            {cargando ? (
              <p style={{ margin: 0, fontSize: "12.5px", color: "#64748b" }}>Cargando datos de versión...</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12.5px", color: "#334155" }}>
                <div><strong>Aplicación:</strong> {versionData?.nombre || "Planifica Maestro PWA"}</div>
                <div><strong>Caché PWA:</strong> <code style={{ background: "#e2e8f0", padding: "2px 6px", borderRadius: "4px" }}>{versionData?.cache_version || "planifica-maestro-v4"}</code></div>
                <div><strong>Commit desplegado:</strong> <code style={{ background: "#e2e8f0", padding: "2px 6px", borderRadius: "4px" }}>{versionData?.commit || "0e9aea2"}</code></div>
                {versionData?.fecha && (
                  <div><strong>Fecha de build:</strong> {new Date(versionData.fecha).toLocaleString("es-DO")}</div>
                )}
                <div><strong>Ambiente:</strong> <span style={{ color: "#166534", fontWeight: "600" }}>{versionData?.ambiente || "producción"}</span> (Cloudflare Workers)</div>
              </div>
            )}
          </div>

          {/* Estado de la comprobación */}
          {mensajeActualizacion && (
            <div style={{
              background: hayNuevaVersion ? "#f0fdf4" : "#eff6ff",
              border: `1.5px solid ${hayNuevaVersion ? "#86efac" : "#bfdbfe"}`,
              color: hayNuevaVersion ? "#166534" : "#1e40af",
              borderRadius: "10px",
              padding: "12px 14px",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              gap: "10px"
            }}>
              <span style={{ fontSize: "18px" }}>{hayNuevaVersion ? "✨" : "✓"}</span>
              <span><strong>{mensajeActualizacion}</strong></span>
            </div>
          )}

          {/* Botones de acción */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "4px" }}>
            {hayNuevaVersion ? (
              <button
                type="button"
                onClick={() => {
                  if (onAplicarActualizacion) {
                    onAplicarActualizacion();
                  } else {
                    handleRecargarApp();
                  }
                }}
                style={{
                  background: "#0d9488",
                  color: "white",
                  border: "none",
                  borderRadius: "10px",
                  padding: "12px",
                  fontSize: "14px",
                  fontWeight: "700",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  boxShadow: "0 2px 8px rgba(13, 148, 136, 0.3)"
                }}
              >
                🔄 Actualizar ahora
              </button>
            ) : (
              <button
                type="button"
                onClick={handleBuscarActualizacion}
                disabled={buscando}
                style={{
                  background: "var(--teal, #1a7d8c)",
                  color: "white",
                  border: "none",
                  borderRadius: "10px",
                  padding: "12px",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: buscando ? "wait" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px"
                }}
              >
                <span>{buscando ? "Buscando en el servidor..." : "🔍 Buscar actualización"}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleRecargarApp}
              style={{
                background: "#f1f5f9",
                color: "#334155",
                border: "1.5px solid #cbd5e1",
                borderRadius: "10px",
                padding: "10px",
                fontSize: "13.5px",
                fontWeight: "600",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px"
              }}
            >
              🔄 Recargar app
            </button>
          </div>

          <p style={{ margin: "6px 0 0 0", fontSize: "11px", color: "#94a3b8", textAlign: "center", lineHeight: "1.4" }}>
            En modo standalone (sin barra de navegador), esta pantalla te permite verificar versiones y forzar la recarga limpia de la aplicación en cualquier momento.
          </p>

        </div>
      </div>
    </div>
  );
}
