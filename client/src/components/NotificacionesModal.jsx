export default function NotificacionesModal({ onCerrar, isOnline, estadoCuota }) {
  return (
    <div className="schema-overlay" onClick={onCerrar} style={{ zIndex: 1200 }}>
      <div className="schema-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "480px" }}>
        
        <div className="schema-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "24px" }}>🔔</span>
            <div>
              <h2 style={{ margin: 0, fontSize: "18px" }}>Notificaciones y Estado</h2>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "rgba(255,255,255,0.85)" }}>
                Avisos del sistema y calendario escolar oficial
              </p>
            </div>
          </div>
          <button className="schema-close-btn" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </div>

        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: "12px", maxHeight: "75vh", overflowY: "auto" }}>
          
          {/* 1. Estado de Conectividad */}
          <div style={{
            background: isOnline ? "#f0fdf4" : "#fef2f2",
            border: `1.5px solid ${isOnline ? "#86efac" : "#fca5a5"}`,
            borderRadius: "12px",
            padding: "12px",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px"
          }}>
            <span style={{ fontSize: "20px" }}>{isOnline ? "🟢" : "📡"}</span>
            <div>
              <strong style={{ fontSize: "13.5px", color: isOnline ? "#166534" : "#991b1b" }}>
                {isOnline ? "Conexión Activa a la Nube" : "Modo Sin Conexión (Offline)"}
              </strong>
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: isOnline ? "#15803d" : "#b91c1c" }}>
                {isOnline 
                  ? "Sincronización en tiempo real con el Asistente IA y Supabase." 
                  : "Puedes consultar y editar tus planificaciones guardadas. Los cambios se sincronizarán al reconectar."}
              </p>
            </div>
          </div>

          {/* 2. Estado del RAG Curricular */}
          <div style={{
            background: "#f0fdfa",
            border: "1.5px solid #99f6e4",
            borderRadius: "12px",
            padding: "12px",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px"
          }}>
            <span style={{ fontSize: "20px" }}>📚</span>
            <div>
              <strong style={{ fontSize: "13.5px", color: "#0f766e" }}>
                Currículo MINERD y Programa Con Base
              </strong>
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#115e59" }}>
                Motor RAG oficial verificado con la Adecuación Curricular 2023, Guías Con Base (UNICEF/MINERD) y Ordenanzas vigentes.
              </p>
            </div>
          </div>

          {/* 3. Cuota de Generación */}
          {estadoCuota && (
            <div style={{
              background: "#fffbeb",
              border: "1.5px solid #fde68a",
              borderRadius: "12px",
              padding: "12px",
              display: "flex",
              alignItems: "flex-start",
              gap: "10px"
            }}>
              <span style={{ fontSize: "20px" }}>⚡</span>
              <div>
                <strong style={{ fontSize: "13.5px", color: "#92400e" }}>
                  Cuota de Planificaciones: {estadoCuota.usadas} de {estadoCuota.limite}
                </strong>
                <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#b45309" }}>
                  {estadoCuota.agotado 
                    ? "Has completado el límite del período. Puedes continuar editando y exportando las existentes."
                    : `Dispones de ${estadoCuota.limite - estadoCuota.usadas} planificaciones en este período.`}
                </p>
              </div>
            </div>
          )}

          {/* 4. Calendario Escolar Oficial MINERD (Resolución 10-2024) */}
          <div style={{
            background: "#f8fafc",
            border: "1.5px solid #e2e8f0",
            borderRadius: "12px",
            padding: "12px",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px"
          }}>
            <span style={{ fontSize: "20px" }}>📅</span>
            <div>
              <strong style={{ fontSize: "13.5px", color: "#1e293b" }}>
                Calendario Escolar Oficial 2024-2025
              </strong>
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#475569" }}>
                Resolución N.º 10-2024 del Consejo Nacional de Educación. Mantén tus planificaciones alineadas a los períodos lectivos (P1, P2, P3 y P4) y a las efemérides patrias dominicanas.
              </p>
            </div>
          </div>

        </div>

        <div style={{ padding: "12px 18px", borderTop: "1px solid #e2e8f0", textAlign: "right" }}>
          <button 
            type="button" 
            className="schema-card-preview-btn" 
            onClick={onCerrar}
            style={{ padding: "8px 18px", fontSize: "13px", background: "var(--pm-navy, #12304a)", color: "#fff", border: "none", borderRadius: "8px" }}
          >
            Entendido
          </button>
        </div>

      </div>
    </div>
  );
}
