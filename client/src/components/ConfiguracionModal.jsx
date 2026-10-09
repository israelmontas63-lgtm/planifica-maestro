import { useState } from "react";
import { obtenerTodasLasPlanificaciones } from "../services/bibliotecaStorage.js";
import { SOPORTE_EMAIL, TEXTO_PRIVACIDAD_AUDIO, TEXTO_PRIVACIDAD_FOTOS } from "../config/constantes.js";

export default function ConfiguracionModal({ 
  onCerrar, 
  hablarRespuestas, 
  setHablarRespuestas, 
  silenceTimeoutMs = 2500,
  setSilenceTimeoutMs,
  confirmarVozAntes = false,
  setConfirmarVozAntes,
  onAbrirPerfil 
}) {
  const [limpiado, setLimpiado] = useState(false);
  const [modeloIA, setModeloIA] = useState(() => {
    try {
      return localStorage.getItem("pm_modelo_ia") || "gemini-3.1-flash-lite";
    } catch (e) {
      return "gemini-3.1-flash-lite";
    }
  });
  const totalPlanes = obtenerTodasLasPlanificaciones().length;

  const handleCambiarModelo = (nuevoModelo) => {
    setModeloIA(nuevoModelo);
    try {
      localStorage.setItem("pm_modelo_ia", nuevoModelo);
    } catch (e) {}
  };

  const handleLimpiarCache = () => {
    if (window.confirm("¿Deseas limpiar la memoria temporal y caché del navegador? Tus planificaciones guardadas y perfil NO se borrarán.")) {
      try {
        if ("caches" in window) {
          caches.keys().then((names) => {
            names.forEach((name) => caches.delete(name));
          });
        }
        setLimpiado(true);
        setTimeout(() => setLimpiado(false), 2500);
      } catch (err) {
        console.warn("Error limpiando caché:", err);
      }
    }
  };

  return (
    <div className="schema-overlay" onClick={onCerrar} style={{ zIndex: 1200 }}>
      <div className="schema-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "500px" }}>
        
        <div className="schema-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "24px" }}>⚙️</span>
            <div>
              <h2 style={{ margin: 0, fontSize: "18px" }}>Configuración del Sistema</h2>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "rgba(255,255,255,0.85)" }}>
                Ajustes de voz, almacenamiento y soporte técnico
              </p>
            </div>
          </div>
          <button className="schema-close-btn" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </div>

        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: "14px", maxHeight: "75vh", overflowY: "auto" }}>
          
          {/* 1. Ajuste de Voz IA */}
          <div style={{
            background: "#ffffff",
            border: "1.5px solid #e2e8f0",
            borderRadius: "12px",
            padding: "14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <div>
              <strong style={{ fontSize: "14px", color: "#1e293b", display: "block" }}>
                🔊 Lectura por Voz de la IA
              </strong>
              <span style={{ fontSize: "12px", color: "#64748b" }}>
                Reproduce en audio las explicaciones y planificaciones generadas
              </span>
            </div>
            <label className="pm-switch" style={{ margin: 0 }}>
              <input 
                type="checkbox" 
                checked={hablarRespuestas} 
                onChange={(e) => setHablarRespuestas?.(e.target.checked)} 
              />
              <div className="pm-switch-track">
                <div className="pm-switch-thumb"></div>
              </div>
            </label>
          </div>

          {/* 1.1 Confirmación de Voz antes de generar */}
          <div style={{
            background: "#ffffff",
            border: "1.5px solid #e2e8f0",
            borderRadius: "12px",
            padding: "14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px"
          }}>
            <div>
              <strong style={{ fontSize: "14px", color: "#1e293b", display: "block" }}>
                🎙️ Confirmar lo que entendí antes de generar
              </strong>
              <span style={{ fontSize: "12px", color: "#64748b" }}>
                Muestra una tarjeta para verificar grado, tema y escuela antes de consultar a la IA
              </span>
            </div>
            <label className="pm-switch" style={{ margin: 0 }}>
              <input 
                type="checkbox" 
                checked={confirmarVozAntes} 
                onChange={(e) => setConfirmarVozAntes?.(e.target.checked)} 
              />
              <div className="pm-switch-track">
                <div className="pm-switch-thumb"></div>
              </div>
            </label>
          </div>

          {/* 2. Ajuste de Pausa del Micrófono (Corte por Silencio) */}
          <div style={{
            background: "#ffffff",
            border: "1.5px solid #e2e8f0",
            borderRadius: "12px",
            padding: "14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px"
          }}>
            <div>
              <strong style={{ fontSize: "14px", color: "#1e293b", display: "block" }}>
                ⏱️ Pausa de Silencio en Micrófono
              </strong>
              <span style={{ fontSize: "12px", color: "#64748b" }}>
                Tiempo de espera sin hablar antes de procesar el dictado
              </span>
            </div>
            <select
              value={silenceTimeoutMs}
              onChange={(e) => setSilenceTimeoutMs?.(Number(e.target.value))}
              style={{
                padding: "6px 10px",
                borderRadius: "8px",
                border: "1.5px solid #cbd5e1",
                background: "#f8fafc",
                fontSize: "13px",
                fontWeight: "600",
                color: "#1e293b",
                cursor: "pointer"
              }}
            >
              <option value={0}>Manual (sin corte automático) - Por defecto</option>
              <option value={1500}>1.5 s (Rápido)</option>
              <option value={2500}>2.5 s (Normal)</option>
              <option value={3500}>3.5 s (Pausado)</option>
              <option value={5000}>5.0 s (Extendido)</option>
            </select>
          </div>

          {/* Selector de Motor de IA */}
          <div style={{
            background: "#ffffff",
            border: "1.5px solid #e2e8f0",
            borderRadius: "12px",
            padding: "14px",
            display: "flex",
            flexDirection: "column",
            gap: "10px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong style={{ fontSize: "14px", color: "#1e293b", display: "block" }}>
                  🧠 Motor de Inteligencia Artificial
                </strong>
                <span style={{ fontSize: "12px", color: "#64748b" }}>
                  Selecciona la velocidad y capacidad de análisis para tus planificaciones
                </span>
              </div>
              <span style={{
                fontSize: "11px",
                fontWeight: "700",
                padding: "3px 8px",
                borderRadius: "12px",
                background: modeloIA === "gemini-3.1-flash-lite" ? "#dcfce7" : "#e0e7ff",
                color: modeloIA === "gemini-3.1-flash-lite" ? "#15803d" : "#4338ca"
              }}>
                {modeloIA === "gemini-3.1-flash-lite" ? "⚡ Ultrarrápido" : "🔬 Alta Capacidad"}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                padding: "10px",
                borderRadius: "8px",
                border: `1.5px solid ${modeloIA === "gemini-3.1-flash-lite" ? "#0d9488" : "#e2e8f0"}`,
                background: modeloIA === "gemini-3.1-flash-lite" ? "#f0fdfa" : "#ffffff",
                cursor: "pointer"
              }}>
                <input
                  type="radio"
                  name="modeloIA"
                  value="gemini-3.1-flash-lite"
                  checked={modeloIA === "gemini-3.1-flash-lite"}
                  onChange={() => handleCambiarModelo("gemini-3.1-flash-lite")}
                  style={{ marginTop: "3px", accentColor: "#0d9488" }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a" }}>
                    Gemini 3.1 Flash-Lite <span style={{ color: "#0d9488", fontWeight: "600" }}>(Recomendado)</span>
                  </div>
                  <div style={{ fontSize: "11.5px", color: "#64748b", marginTop: "2px" }}>
                    Respuesta en ~2.4 s • $0 costo • Optimizado para el currículo dominicano y guías CON BASE.
                  </div>
                </div>
              </label>

              <label style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                padding: "10px",
                borderRadius: "8px",
                border: `1.5px solid ${modeloIA === "gemini-3.5-flash" ? "#0d9488" : "#e2e8f0"}`,
                background: modeloIA === "gemini-3.5-flash" ? "#f0fdfa" : "#ffffff",
                cursor: "pointer"
              }}>
                <input
                  type="radio"
                  name="modeloIA"
                  value="gemini-3.5-flash"
                  checked={modeloIA === "gemini-3.5-flash"}
                  onChange={() => handleCambiarModelo("gemini-3.5-flash")}
                  style={{ marginTop: "3px", accentColor: "#0d9488" }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a" }}>
                    Gemini 3.5 Flash <span style={{ color: "#6366f1", fontWeight: "600" }}>(Mayor Detalle)</span>
                  </div>
                  <div style={{ fontSize: "11.5px", color: "#64748b", marginTop: "2px" }}>
                    Respuesta en ~8.2 s • Redacción más extensa y detallada en proyectos complejos o multigrado.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* 3. Perfil Docente */}
          <div style={{
            background: "#ffffff",
            border: "1.5px solid #e2e8f0",
            borderRadius: "12px",
            padding: "14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <div>
              <strong style={{ fontSize: "14px", color: "#1e293b", display: "block" }}>
                👤 Perfil y Datos de Escuela
              </strong>
              <span style={{ fontSize: "12px", color: "#64748b" }}>
                Nombre del docente, centro educativo y fecha por defecto
              </span>
            </div>
            <button
              type="button"
              onClick={() => { onCerrar(); onAbrirPerfil?.(); }}
              style={{
                padding: "7px 14px",
                borderRadius: "8px",
                border: "1.5px solid #cbd5e1",
                background: "#f8fafc",
                fontSize: "12.5px",
                fontWeight: "600",
                color: "#1e293b",
                cursor: "pointer"
              }}
            >
              Editar
            </button>
          </div>

          {/* 3. Almacenamiento Local y Caché */}
          <div style={{
            background: "#ffffff",
            border: "1.5px solid #e2e8f0",
            borderRadius: "12px",
            padding: "14px"
          }}>
            <strong style={{ fontSize: "14px", color: "#1e293b", display: "block", marginBottom: "4px" }}>
              💾 Almacenamiento Offline y Caché
            </strong>
            <p style={{ margin: "0 0 10px 0", fontSize: "12px", color: "#64748b" }}>
              Tienes <strong>{totalPlanes}</strong> planificación(es) guardada(s) en tu biblioteca local.
            </p>
            <button
              type="button"
              onClick={handleLimpiarCache}
              style={{
                padding: "8px 14px",
                borderRadius: "8px",
                border: "1px solid #fca5a5",
                background: "#fff5f5",
                fontSize: "12px",
                fontWeight: "600",
                color: "#b91c1c",
                cursor: "pointer"
              }}
            >
              {limpiado ? "✓ Caché temporal limpiada" : "🧹 Limpiar caché temporal de la app"}
            </button>
          </div>

          {/* 4. Información Técnica del Asistente */}
          <div style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "12px",
            fontSize: "12px",
            color: "#475569"
          }}>
            <div style={{ fontWeight: "700", color: "#1e293b", marginBottom: "6px" }}>
              ℹ️ Información Técnica, Privacidad y Soporte:
            </div>
            <ul style={{ margin: 0, paddingLeft: "18px", lineHeight: "1.6" }}>
              <li><strong>Motor IA:</strong> Gemini 2.5 Flash + Text-Embedding-004 (pgvector RRF).</li>
              <li><strong>Enciclopedia conceptual:</strong> Wikipedia API (CC BY-SA 4.0).</li>
              <li><strong>Currículo:</strong> Adecuación 2023, Con Base y normativas MINERD.</li>
              <li><strong>Privacidad de Audio:</strong> {TEXTO_PRIVACIDAD_AUDIO}</li>
              <li><strong>Privacidad de Fotos:</strong> {TEXTO_PRIVACIDAD_FOTOS}</li>
              <li><strong>Contacto de soporte:</strong> {SOPORTE_EMAIL}</li>
            </ul>
          </div>

        </div>

        <div style={{ padding: "12px 18px", borderTop: "1px solid #e2e8f0", textAlign: "right" }}>
          <button 
            type="button" 
            onClick={onCerrar}
            style={{ padding: "8px 18px", fontSize: "13px", background: "var(--pm-navy, #12304a)", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer" }}
          >
            Cerrar Ajustes
          </button>
        </div>

      </div>
    </div>
  );
}
