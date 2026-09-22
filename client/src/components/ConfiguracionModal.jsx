import { useState } from "react";
import { obtenerTodasLasPlanificaciones } from "../services/bibliotecaStorage.js";
import { SOPORTE_EMAIL, TEXTO_PRIVACIDAD_AUDIO, TEXTO_PRIVACIDAD_FOTOS } from "../config/constantes.js";

export default function ConfiguracionModal({ 
  onCerrar, 
  hablarRespuestas, 
  setHablarRespuestas, 
  onAbrirPerfil 
}) {
  const [limpiado, setLimpiado] = useState(false);
  const totalPlanes = obtenerTodasLasPlanificaciones().length;

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

          {/* 2. Perfil Docente */}
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
