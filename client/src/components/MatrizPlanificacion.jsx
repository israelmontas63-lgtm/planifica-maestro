import React, { useState } from "react";
import { exportarDocxNativo } from "../services/exportadorDocxNativo.js";

/**
 * client/src/components/MatrizPlanificacion.jsx
 * Componente de renderizado de la Matriz de Planificación Didáctica.
 * Muestra los 3 momentos pedagógicos (Inicio, Desarrollo, Cierre),
 * badges interactivos del programa CON BASE, alertas del Asesor Pedagógico
 * y exportación nativa a Word (.docx) descargable directamente en el cliente.
 */
export default function MatrizPlanificacion({
  matriz,
  auditoria = null,
  asesor = null,
  evidencias = [],
  onExportar = null
}) {
  const [exportando, setExportando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  if (!matriz) return null;

  const metadatos = matriz.metadatos || {};
  const inicio = matriz.inicio || { tiempo: "10 min", puntos: [] };
  const desarrollo = matriz.desarrollo || { tiempo: "25 min", tramos: [], puntos: [] };
  const cierre = matriz.cierre || { tiempo: "10 min", puntos: [] };

  const handleDescargarDocx = async () => {
    try {
      setExportando(true);
      if (typeof onExportar === "function") {
        await onExportar(matriz);
      } else {
        await exportarDocxNativo({
          matriz,
          titulo: `Planificacion_${metadatos.tema || "Clase"}`
        });
      }
    } catch (err) {
      console.error("Error exportando a Word:", err);
      alert("Hubo un detalle al generar el archivo Word. Por favor intenta de nuevo.");
    } finally {
      setExportando(false);
    }
  };

  const handleCopiarTexto = () => {
    const texto = matriz.textoOriginal || JSON.stringify(matriz, null, 2);
    navigator.clipboard?.writeText(texto).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    }).catch(() => {});
  };

  return (
    <div className="pm-matriz-container" style={estilos.contenedor}>
      {/* ── 1. CABECERA Y METADATOS ADMINISTRATIVOS ── */}
      <header style={estilos.cabecera}>
        <div style={estilos.cabeceraTop}>
          <div>
            <span style={estilos.badgeMinisterio}>MINERD • Modelo CON BASE</span>
            <h2 style={estilos.tituloPrincipal}>
              {metadatos.tema || "Planificación Didáctica"}
            </h2>
            <p style={estilos.subtitulo}>
              {metadatos.centro || "Centro Educativo"} • {metadatos.docente || "Docente"}
            </p>
          </div>
          <div style={estilos.accionesSuperiores}>
            <button
              onClick={handleDescargarDocx}
              disabled={exportando}
              style={estilos.btnDocx}
              title="Descargar plantilla oficial en formato Word"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
              <span>{exportando ? "Generando..." : "Descargar DOCX"}</span>
            </button>
            <button
              onClick={handleCopiarTexto}
              style={estilos.btnSecundario}
              title="Copiar texto al portapapeles"
            >
              <span>{copiado ? "✓ Copiado" : "Copiar"}</span>
            </button>
          </div>
        </div>

        {/* Badges de Metadatos */}
        <div style={estilos.badgesRow}>
          <span style={estilos.badgeArea}>📚 {metadatos.area || "Lengua Española"}</span>
          <span style={estilos.badgeGrado}>🎓 {metadatos.grado || "1.° y 2.° Primaria"}</span>
          <span style={estilos.badgeTiempo}>⏱️ {metadatos.tiempo || "45 min"}</span>
          {auditoria?.aprobado && (
            <span style={estilos.badgeAuditoria} title={auditoria.dictamen}>
              🛡️ MINERD Certificado
            </span>
          )}
        </div>
      </header>

      {/* ── 2. ALERTAS DEL ASESOR PEDAGÓGICO INTERACTIVO ── */}
      {((asesor?.redundancia?.esRedundante) || (asesor?.desfase?.tieneDesfase) || (matriz.asesorNotas && matriz.asesorNotas.length > 0)) && (
        <section style={estilos.alertaAsesor} role="alert">
          <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
            <span style={{ fontSize: "20px" }}>💡</span>
            <div>
              <strong style={{ color: "#92400e", display: "block", marginBottom: "4px" }}>
                Orientación del Asesor Pedagógico Colega:
              </strong>
              {asesor?.redundancia?.sugerenciaPausaActiva && (
                <p style={estilos.textoAlerta}>{asesor.redundancia.sugerenciaPausaActiva}</p>
              )}
              {asesor?.desfase?.recomendacion && (
                <p style={estilos.textoAlerta}>{asesor.desfase.recomendacion}</p>
              )}
              {matriz.asesorNotas?.map((nota, i) => (
                <p key={i} style={estilos.textoAlerta}>{nota}</p>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 3. MATRIZ DE LOS 3 MOMENTOS DIDÁCTICOS ── */}
      <main style={estilos.matrizCuerpo}>
        {/* MOMENTO 1: INICIO */}
        <article style={estilos.tarjetaMomentoInicio}>
          <div style={estilos.momentoHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={estilos.momentoNumero}>1</span>
              <h3 style={estilos.momentoTitulo}>Inicio</h3>
            </div>
            <span style={estilos.momentoTiempo}>{inicio.tiempo || "10 min"}</span>
          </div>
          <div style={estilos.momentoBadgeSub}>Activación, Saberes Previos y Propósito</div>
          <ul style={estilos.listaPuntos}>
            {inicio.puntos.map((pt, idx) => (
              <li key={idx} style={estilos.itemPunto}>
                <span style={estilos.bullet}>•</span>
                <span>{pt}</span>
              </li>
            ))}
          </ul>
        </article>

        {/* MOMENTO 2: DESARROLLO (CON BASE MULTIGRADO) */}
        <article style={estilos.tarjetaMomentoDesarrollo}>
          <div style={estilos.momentoHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ ...estilos.momentoNumero, background: "#0284c7" }}>2</span>
              <h3 style={estilos.momentoTitulo}>Desarrollo (Secuencia Didáctica)</h3>
            </div>
            <span style={{ ...estilos.momentoTiempo, background: "#e0f2fe", color: "#0369a1" }}>
              {desarrollo.tiempo || "25 min"}
            </span>
          </div>

          {/* Tramos CON BASE */}
          {desarrollo.tramos && desarrollo.tramos.length > 0 ? (
            <div style={estilos.tramosContainer}>
              {desarrollo.tramos.map((tramo, tIdx) => {
                const colorEstilo = obtenerEstiloBadgeTramo(tramo.badgeTipo);
                return (
                  <div key={tIdx} style={{ ...estilos.tramoCard, borderColor: colorEstilo.border }}>
                    <div style={{ ...estilos.tramoBadge, background: colorEstilo.bg, color: colorEstilo.text }}>
                      {tramo.badgeEtiqueta}
                    </div>
                    <div style={estilos.tramoCuerpo}>
                      <p style={estilos.tramoCabecera}>{tramo.cabecera}</p>
                      <ul style={estilos.listaPuntos}>
                        {tramo.puntos.map((p, pIdx) => (
                          <li key={pIdx} style={estilos.itemPunto}>
                            <span style={{ ...estilos.bullet, color: colorEstilo.text }}>•</span>
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <ul style={estilos.listaPuntos}>
              {desarrollo.puntos.map((pt, idx) => (
                <li key={idx} style={estilos.itemPunto}>
                  <span style={estilos.bullet}>•</span>
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          )}
        </article>

        {/* MOMENTO 3: CIERRE */}
        <article style={estilos.tarjetaMomentoCierre}>
          <div style={estilos.momentoHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ ...estilos.momentoNumero, background: "#16a34a" }}>3</span>
              <h3 style={estilos.momentoTitulo}>Cierre</h3>
            </div>
            <span style={{ ...estilos.momentoTiempo, background: "#dcfce7", color: "#15803d" }}>
              {cierre.tiempo || "10 min"}
            </span>
          </div>
          <div style={{ ...estilos.momentoBadgeSub, color: "#166534" }}>
            Evaluación Formativa, Metacognición & Síntesis
          </div>
          <ul style={estilos.listaPuntos}>
            {cierre.puntos.map((pt, idx) => (
              <li key={idx} style={estilos.itemPunto}>
                <span style={{ ...estilos.bullet, color: "#16a34a" }}>•</span>
                <span>{pt}</span>
              </li>
            ))}
          </ul>
        </article>
      </main>

      {/* ── 4. EVIDENCIAS Y CITAS CURRICULARES OFICIALES ── */}
      {evidencias && evidencias.length > 0 && (
        <footer style={estilos.pieEvidencias}>
          <h4 style={estilos.tituloEvidencias}>📖 Fuentes Curriculares Oficiales Citadas (MINERD):</h4>
          <div style={estilos.evidenciasGrid}>
            {evidencias.map((ev, i) => (
              <div key={i} style={estilos.evidenciaChip}>
                <span style={estilos.evidenciaFuente}>{ev.documento_titulo || ev.fuente || "Diseño Curricular"}</span>
                <span style={estilos.evidenciaPagina}>Pág. {ev.numero_pagina || ev.pagina || "Oficial"}</span>
              </div>
            ))}
          </div>
        </footer>
      )}
    </div>
  );
}

function obtenerEstiloBadgeTramo(tipo) {
  switch (tipo) {
    case "mediacion":
      return { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" };
    case "autonomo":
      return { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" };
    case "encuentro":
      return { bg: "#faf5ff", text: "#7e22ce", border: "#e9d5ff" };
    default:
      return { bg: "#f8fafc", text: "#334155", border: "#e2e8f0" };
  }
}

const estilos = {
  contenedor: {
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    padding: "20px",
    margin: "16px 0",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
    fontFamily: "system-ui, -apple-system, sans-serif"
  },
  cabecera: {
    borderBottom: "2px solid #e2e8f0",
    paddingBottom: "16px",
    marginBottom: "16px"
  },
  cabeceraTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: "12px"
  },
  badgeMinisterio: {
    fontSize: "11px",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    color: "#0369a1",
    background: "#e0f2fe",
    padding: "3px 8px",
    borderRadius: "4px"
  },
  tituloPrincipal: {
    margin: "8px 0 4px 0",
    fontSize: "20px",
    fontWeight: "800",
    color: "#0f172a"
  },
  subtitulo: {
    margin: 0,
    fontSize: "13px",
    color: "#64748b"
  },
  accionesSuperiores: {
    display: "flex",
    alignItems: "center",
    gap: "8px"
  },
  btnDocx: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    background: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    padding: "8px 14px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 2px 4px rgba(37, 99, 235, 0.2)"
  },
  btnSecundario: {
    background: "#f1f5f9",
    color: "#334155",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer"
  },
  badgesRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginTop: "12px"
  },
  badgeArea: {
    background: "#fef3c7",
    color: "#92400e",
    fontSize: "12px",
    fontWeight: "600",
    padding: "4px 8px",
    borderRadius: "6px"
  },
  badgeGrado: {
    background: "#ede9fe",
    color: "#5b21b6",
    fontSize: "12px",
    fontWeight: "600",
    padding: "4px 8px",
    borderRadius: "6px"
  },
  badgeTiempo: {
    background: "#f1f5f9",
    color: "#475569",
    fontSize: "12px",
    fontWeight: "600",
    padding: "4px 8px",
    borderRadius: "6px"
  },
  badgeAuditoria: {
    background: "#dcfce7",
    color: "#166534",
    fontSize: "12px",
    fontWeight: "700",
    padding: "4px 8px",
    borderRadius: "6px"
  },
  alertaAsesor: {
    background: "#fffbeb",
    border: "1px solid #fde68a",
    borderRadius: "8px",
    padding: "12px 14px",
    marginBottom: "16px"
  },
  textoAlerta: {
    margin: "4px 0",
    fontSize: "13px",
    lineHeight: "1.4",
    color: "#78350f"
  },
  matrizCuerpo: {
    display: "flex",
    flexDirection: "column",
    gap: "16px"
  },
  tarjetaMomentoInicio: {
    background: "#f8fafc",
    border: "1px solid #cbd5e1",
    borderLeft: "4px solid #6366f1",
    borderRadius: "8px",
    padding: "14px"
  },
  tarjetaMomentoDesarrollo: {
    background: "#f8fafc",
    border: "1px solid #cbd5e1",
    borderLeft: "4px solid #0284c7",
    borderRadius: "8px",
    padding: "14px"
  },
  tarjetaMomentoCierre: {
    background: "#f8fafc",
    border: "1px solid #cbd5e1",
    borderLeft: "4px solid #16a34a",
    borderRadius: "8px",
    padding: "14px"
  },
  momentoHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "4px"
  },
  momentoNumero: {
    width: "22px",
    height: "22px",
    borderRadius: "50%",
    background: "#6366f1",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: "bold"
  },
  momentoTitulo: {
    margin: 0,
    fontSize: "16px",
    fontWeight: "700",
    color: "#0f172a"
  },
  momentoTiempo: {
    fontSize: "12px",
    fontWeight: "700",
    background: "#ede9fe",
    color: "#4338ca",
    padding: "2px 8px",
    borderRadius: "12px"
  },
  momentoBadgeSub: {
    fontSize: "12px",
    fontWeight: "500",
    color: "#4338ca",
    marginBottom: "10px"
  },
  listaPuntos: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    display: "flex",
    flexDirection: "column",
    gap: "8px"
  },
  itemPunto: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    fontSize: "13.5px",
    lineHeight: "1.5",
    color: "#334155"
  },
  bullet: {
    color: "#6366f1",
    fontWeight: "bold",
    fontSize: "16px",
    lineHeight: "1"
  },
  tramosContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    marginTop: "10px"
  },
  tramoCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    overflow: "hidden"
  },
  tramoBadge: {
    fontSize: "12px",
    fontWeight: "700",
    padding: "5px 12px",
    borderBottom: "1px solid #e2e8f0"
  },
  tramoCuerpo: {
    padding: "10px 12px"
  },
  tramoCabecera: {
    margin: "0 0 6px 0",
    fontSize: "13px",
    fontWeight: "600",
    color: "#0f172a"
  },
  pieEvidencias: {
    marginTop: "16px",
    paddingTop: "12px",
    borderTop: "1px dashed #cbd5e1"
  },
  tituloEvidencias: {
    margin: "0 0 8px 0",
    fontSize: "12px",
    fontWeight: "700",
    color: "#475569",
    textTransform: "uppercase"
  },
  evidenciasGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px"
  },
  evidenciaChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    background: "#f1f5f9",
    border: "1px solid #e2e8f0",
    borderRadius: "6px",
    padding: "4px 8px",
    fontSize: "11.5px"
  },
  evidenciaFuente: {
    color: "#334155",
    fontWeight: "500"
  },
  evidenciaPagina: {
    color: "#2563eb",
    fontWeight: "700"
  }
};
