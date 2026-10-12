import { useState, useMemo } from "react";
import {
  obtenerNotificacionesDocente,
  marcarNotificacionLeida,
  marcarTodasNotificacionesLeidas
} from "../services/coordinacionService.js";

export default function NotificacionesModal({
  onCerrar,
  isOnline,
  estadoCuota,
  user,
  planesDocente,
  onAbrirPlanConRevision
}) {
  const [notificaciones, setNotificaciones] = useState(() =>
    obtenerNotificacionesDocente({ userId: user?.id, planes: planesDocente })
  );

  const noLeidas = useMemo(
    () => notificaciones.filter((n) => !n.leida).length,
    [notificaciones]
  );

  function handleMarcarTodasLeidas() {
    marcarTodasNotificacionesLeidas(user?.id, planesDocente);
    setNotificaciones(
      obtenerNotificacionesDocente({ userId: user?.id, planes: planesDocente })
    );
  }

  function handleVerPlan(notif) {
    marcarNotificacionLeida(notif.id, user?.id);
    if (notif.revisionId) marcarNotificacionLeida(notif.revisionId, user?.id);
    if (onAbrirPlanConRevision) {
      onAbrirPlanConRevision(notif.planId);
    }
  }

  return (
    <div className="schema-overlay" onClick={onCerrar} style={{ zIndex: 1200 }}>
      <div className="schema-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "520px" }}>
        
        <div className="schema-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "24px" }}>🔔</span>
            <div>
              <h2 style={{ margin: 0, fontSize: "18px" }}>Notificaciones y Estado</h2>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "rgba(255,255,255,0.85)" }}>
                Avisos institucionales, dictámenes de supervisión y calendario escolar
              </p>
            </div>
          </div>
          <button className="schema-close-btn" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </div>

        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: "12px", maxHeight: "75vh", overflowY: "auto" }}>
          
          {/* SECCIÓN DICTÁMENES PEDAGÓGICOS MINERD */}
          <div style={{ marginBottom: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <strong style={{ fontSize: "14px", color: "var(--pm-navy, #12304a)" }}>
                  📋 Dictámenes de Supervisión
                </strong>
                {noLeidas > 0 && (
                  <span style={{
                    background: "#ef4444",
                    color: "#fff",
                    fontSize: "11px",
                    fontWeight: "700",
                    padding: "1px 7px",
                    borderRadius: "999px"
                  }}>
                    {noLeidas} nuevas
                  </span>
                )}
              </div>
              {noLeidas > 0 && (
                <button
                  type="button"
                  onClick={handleMarcarTodasLeidas}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#0284c7",
                    fontSize: "11.5px",
                    cursor: "pointer",
                    textDecoration: "underline",
                    padding: "2px"
                  }}
                >
                  Marcar todas leídas
                </button>
              )}
            </div>

            {notificaciones.length === 0 ? (
              <div style={{
                background: "#f8fafc",
                border: "1px dashed #cbd5e1",
                borderRadius: "10px",
                padding: "12px",
                textAlign: "center",
                color: "#64748b",
                fontSize: "12.5px"
              }}>
                <span>Sin dictámenes pendientes de revisión</span>
                <p style={{ margin: "4px 0 0 0", fontSize: "11.5px", color: "#94a3b8" }}>
                  Cuando el coordinador revise una de tus planificaciones enviadas, aparecerá aquí su dictamen pedagógico.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {notificaciones.map((notif) => {
                  const esAprobada = notif.estadoRevision === "aprobada";
                  return (
                    <div
                      key={notif.id}
                      style={{
                        background: notif.leida ? "#ffffff" : "#f0fdf4",
                        border: `1.5px solid ${esAprobada ? "#86efac" : "#fed7aa"}`,
                        borderLeft: `4px solid ${esAprobada ? "#16a34a" : "#f97316"}`,
                        borderRadius: "10px",
                        padding: "12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        boxShadow: notif.leida ? "none" : "0 2px 6px rgba(0,0,0,0.04)"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                            <span style={{
                              fontSize: "11px",
                              fontWeight: "700",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: esAprobada ? "#dcfce7" : "#ffedd5",
                              color: esAprobada ? "#166534" : "#9a3412"
                            }}>
                              {esAprobada ? "✓ Aprobada" : "⚠️ Con Observaciones"}
                            </span>
                            {!notif.leida && (
                              <span style={{
                                fontSize: "10px",
                                fontWeight: "800",
                                padding: "1px 5px",
                                borderRadius: "4px",
                                background: "#fee2e2",
                                color: "#b91c1c"
                              }}>
                                NUEVA
                              </span>
                            )}
                          </div>
                          <h4 style={{ margin: "4px 0 2px 0", fontSize: "13.5px", color: "#1e293b", fontWeight: "600" }}>
                            {notif.tituloPlan}
                          </h4>
                          <span style={{ fontSize: "11px", color: "#64748b" }}>
                            {notif.coordinadorNombre} • {new Date(notif.fecha).toLocaleDateString("es-DO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleVerPlan(notif)}
                          style={{
                            background: "var(--pm-navy, #12304a)",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: "6px",
                            padding: "6px 10px",
                            fontSize: "11.5px",
                            fontWeight: "600",
                            cursor: "pointer",
                            whiteSpace: "nowrap"
                          }}
                          title="Abrir planificación en Mis Planificaciones y ver dictamen completo"
                        >
                          🔍 Ver Plan
                        </button>
                      </div>

                      {notif.comentariosGenerales && (
                        <p style={{
                          margin: 0,
                          fontSize: "12px",
                          color: "#334155",
                          background: "#f8fafc",
                          padding: "6px 8px",
                          borderRadius: "6px"
                        }}>
                          "{notif.comentariosGenerales}"
                        </p>
                      )}

                      {notif.bloquesObservados?.dua && (
                        <span style={{
                          fontSize: "11.5px",
                          color: "#0f766e",
                          fontWeight: "500"
                        }}>
                          🧩 <strong>Pauta DUA:</strong> {notif.bloquesObservados.dua}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ height: "1px", background: "#e2e8f0", margin: "2px 0" }} />

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
