import { useState, useEffect } from "react";
import EsquemaPreviewModal from "./EsquemaPreviewModal.jsx";
import { obtenerEsquemasCurriculares } from "../services/api.js";

import { ESQUEMAS, PERIODOS } from "../data/esquemasData.js";
export { ESQUEMAS, PERIODOS };

export default function SchemaSelector({ onSeleccionar, onCerrar, periodoActivo, nivelActivo }) {
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState(periodoActivo || "diaria");
  const [esquemasDefs, setEsquemasDefs] = useState(null);
  const [previewEsquemaId, setPreviewEsquemaId] = useState(null);

  // FASE 20: Carga de definiciones oficiales de esquemas desde server/curriculum/levels.js
  useEffect(() => {
    obtenerEsquemasCurriculares()
      .then((defs) => {
        if (defs) setEsquemasDefs(defs);
      })
      .catch((err) => {
        console.warn("Aviso cargando esquemas oficiales:", err);
      });
  }, []);

  return (
    <div className="schema-overlay" onClick={onCerrar}>
      <div className="schema-panel" onClick={(e) => e.stopPropagation()}>
        
        {/* Header del panel */}
        <div className="schema-header">
          <div>
            <h2 style={{ margin: 0 }}>Esquemas de Planificación</h2>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#64748b" }}>
              Toca una tarjeta para usar el esquema o pulsa <strong>👁️ Vista previa</strong> para ver sus campos vacíos
            </p>
          </div>
          <button className="schema-close-btn" onClick={onCerrar}>✕</button>
        </div>

        {/* Selector de periodo */}
        <div className="schema-periodo-bar">
          {PERIODOS.map((p) => (
            <button
              key={p.value}
              className={`schema-periodo-chip ${periodoSeleccionado === p.value ? "active" : ""}`}
              onClick={() => setPeriodoSeleccionado(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Grid de tarjetas con botón de Vista Previa */}
        <div className="schema-grid">
          {ESQUEMAS.map((esq) => (
            <div
              key={esq.id}
              className={`schema-card ${nivelActivo === esq.id ? "selected" : ""}`}
              style={{ borderLeftColor: esq.color !== "#FFFFFF" ? esq.color : undefined, cursor: "pointer" }}
              onClick={() => {
                onSeleccionar(periodoSeleccionado, esq.id);
                onCerrar();
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  onSeleccionar(periodoSeleccionado, esq.id);
                  onCerrar();
                }
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", width: "100%" }}>
                <div className="schema-card-nombre">{esq.nombre}</div>
                <button
                  type="button"
                  className="schema-card-preview-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewEsquemaId(esq.id);
                  }}
                  title="Ver plantilla vacía de este esquema"
                  aria-label={`Ver plantilla vacía de ${esq.nombre}`}
                >
                  👁️ Vista previa
                </button>
              </div>
              <div className="schema-card-desc">{esq.descripcion}</div>
              <div className="schema-card-nivel">{esq.niveles}</div>
              {nivelActivo === esq.id && <span className="schema-card-check">✓ Activo</span>}
            </div>
          ))}
        </div>

        {/* FASE 20: Modal de Vista Previa de Plantilla Vacía */}
        {previewEsquemaId && (
          <EsquemaPreviewModal
            esquemaId={previewEsquemaId}
            esquemaDef={esquemasDefs ? esquemasDefs[previewEsquemaId] : null}
            periodoActivo={periodoSeleccionado}
            onCerrar={() => setPreviewEsquemaId(null)}
            onConfirmar={(periodo, id) => {
              setPreviewEsquemaId(null);
              onSeleccionar(periodo, id);
              onCerrar();
            }}
          />
        )}
      </div>
    </div>
  );
}
