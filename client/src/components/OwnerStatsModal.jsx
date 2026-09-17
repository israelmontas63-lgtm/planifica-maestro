import { useState, useEffect } from "react";
import { obtenerOwnerStats } from "../services/api.js";

export default function OwnerStatsModal({ onCerrar }) {
  const [stats, setStats] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const cargarStats = async () => {
    setCargando(true);
    setErrorMsg(null);
    try {
      const data = await obtenerOwnerStats();
      setStats(data);
    } catch (err) {
      setErrorMsg(err.message || "Error al cargar las métricas.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarStats();
  }, []);

  return (
    <div className="pm-auth-overlay" onClick={onCerrar} style={{ zIndex: 1100 }}>
      <div 
        className="pm-auth-card" 
        onClick={(e) => e.stopPropagation()} 
        style={{ maxWidth: "500px", maxHeight: "85vh", display: "flex", flexDirection: "column", border: "1.5px solid #d97706" }}
      >
        <button
          type="button"
          className="pm-auth-close-btn"
          onClick={onCerrar}
          title="Cerrar"
          aria-label="Cerrar modal de estadísticas"
        >
          ✕
        </button>

        <div className="pm-auth-header" style={{ marginBottom: "12px" }}>
          <div style={{ fontSize: "28px" }}>📊</div>
          <h2 style={{ margin: 0, fontSize: "18px", color: "#12304a", fontWeight: "800" }}>
            Panel de Métricas del Sistema
          </h2>
          <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#64748b" }}>
            Visión global del uso de Planifica Maestro en tiempo real
          </p>
        </div>

        {cargando && (
          <div style={{ textAlign: "center", padding: "30px 0" }}>
            <div className="pm-auth-spinner"></div>
            <p style={{ marginTop: "10px", fontSize: "13px", color: "#64748b" }}>Cargando métricas del servidor...</p>
          </div>
        )}

        {errorMsg && (
          <div className="pm-auth-alert pm-auth-error">
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {!cargando && stats && (
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "14px" }}>
            {/* Tarjetas de Resumen */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "12px", textAlign: "center" }}>
                <span style={{ fontSize: "22px", fontWeight: "800", color: "#1a7d8c", display: "block" }}>
                  {stats.totalDocentes || 0}
                </span>
                <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "600" }}>Docentes Activos</span>
              </div>
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "12px", textAlign: "center" }}>
                <span style={{ fontSize: "22px", fontWeight: "800", color: "#d97706", display: "block" }}>
                  {stats.totalPlanificaciones || 0}
                </span>
                <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "600" }}>Planes Generados</span>
              </div>
            </div>

            {/* Detalle por Docente */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <h4 style={{ margin: 0, fontSize: "13px", color: "#334155" }}>Actividad por Docente:</h4>
                <button
                  type="button"
                  onClick={cargarStats}
                  style={{ background: "none", border: "none", color: "#1a7d8c", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}
                >
                  🔄 Actualizar
                </button>
              </div>

              {(!stats.listaDocentes || stats.listaDocentes.length === 0) ? (
                <p style={{ fontSize: "12px", color: "#94a3b8", fontStyle: "italic", textAlign: "center", margin: "14px 0" }}>
                  Aún no hay registros de cuota generados.
                </p>
              ) : (
                <div style={{ maxHeight: "200px", overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: "10px", background: "#ffffff" }}>
                  {stats.listaDocentes.map((d, idx) => (
                    <div 
                      key={idx} 
                      style={{ 
                        padding: "8px 12px", 
                        borderBottom: idx < stats.listaDocentes.length - 1 ? "1px solid #f1f5f9" : "none",
                        display: "flex", 
                        justifyContent: "space-between", 
                        alignItems: "center",
                        fontSize: "12px"
                      }}
                    >
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "230px" }}>
                        <span style={{ fontWeight: "700", color: "#1e293b" }}>{d.docenteId}</span>
                        <span style={{ display: "block", fontSize: "10.5px", color: "#94a3b8" }}>Periodo: {d.periodo}</span>
                      </div>
                      <span style={{ 
                        background: d.usadas > 15 ? "#fee2e2" : "#f0fdf4", 
                        color: d.usadas > 15 ? "#991b1b" : "#166534",
                        fontWeight: "700",
                        padding: "2px 8px",
                        borderRadius: "10px",
                        fontSize: "11.5px"
                      }}>
                        ⚡ {d.usadas} planes
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onCerrar}
          style={{
            marginTop: "14px",
            width: "100%",
            padding: "10px",
            borderRadius: "10px",
            background: "#f1f5f9",
            border: "none",
            color: "#475569",
            fontWeight: "700",
            fontSize: "13px",
            cursor: "pointer"
          }}
        >
          Cerrar Panel
        </button>
      </div>
    </div>
  );
}
