import { useState } from "react";

const SECCIONES = ["Planificación Diaria", "Planificación Mensual", "Planificación Anual"];
const PERIODO_POR_SECCION = { 0: "diaria", 1: "mensual", 2: "anual" };

/* Ícono micrófono SVG */
function MicIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}

/* Ícono teclado SVG */
function KeyboardIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#12304a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="14" rx="3" />
      <line x1="6" y1="10" x2="6" y2="10" strokeWidth="2.5" />
      <line x1="10" y1="10" x2="10" y2="10" strokeWidth="2.5" />
      <line x1="14" y1="10" x2="14" y2="10" strokeWidth="2.5" />
      <line x1="18" y1="10" x2="18" y2="10" strokeWidth="2.5" />
      <line x1="6" y1="14" x2="6" y2="14" strokeWidth="2.5" />
      <line x1="10" y1="14" x2="10" y2="14" strokeWidth="2.5" />
      <line x1="14" y1="14" x2="14" y2="14" strokeWidth="2.5" />
      <line x1="18" y1="14" x2="18" y2="14" strokeWidth="2.5" />
      <line x1="8" y1="18" x2="16" y2="18" strokeWidth="2.5" />
    </svg>
  );
}

export default function BottomPanel({
  periodoActivo,
  nivelActivo,
  onSeleccionarEsquema,
  listening,
  onDictadoClick,
  onAbrirTexto,
}) {
  const [menuOpen, setMenuOpen] = useState(true);
  const [expandedSeccion, setExpandedSeccion] = useState(null);

  const SECCIONES = [
    { label: "Planificación Diaria", value: "diaria" },
    { label: "Planificación Mensual", value: "mensual" },
    { label: "Planificación Anual", value: "anual" }
  ];

  const ESQUEMAS = [
    { value: "inicial", label: "Esquema Tradicional (Inicial)" },
    { value: "primario", label: "Esquema Tradicional (Primario)" },
    { value: "secundario", label: "Esquema Tradicional (Secundario)" },
    { value: "conbase", label: "Esquema 'Con Base' (1ro a 3ro Primaria)" },
    { value: "especial", label: "Esquema Educación Especial" }
  ];

  return (
    <div className="bottom-panel">
      <div className="menu-toggle" onClick={() => setMenuOpen((m) => !m)}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <line x1="2" y1="4" x2="14" y2="4" stroke="#12304a" strokeWidth="2" strokeLinecap="round" />
          <line x1="2" y1="8" x2="14" y2="8" stroke="#12304a" strokeWidth="2" strokeLinecap="round" />
          <line x1="2" y1="12" x2="14" y2="12" stroke="#12304a" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span>Esquemas de Planificación</span>
      </div>

      {menuOpen && (
        <div className="menu-list" style={{ maxHeight: '250px', overflowY: 'auto' }}>
          {SECCIONES.map((sec) => (
            <div key={sec.value}>
              <button
                className={periodoActivo === sec.value ? "active" : ""}
                onClick={() => setExpandedSeccion(expandedSeccion === sec.value ? null : sec.value)}
                style={{ justifyContent: 'space-between' }}
              >
                <span>
                  {periodoActivo === sec.value && <span className="menu-dot" />}
                  {sec.label}
                </span>
                <span style={{ fontSize: '10px' }}>{expandedSeccion === sec.value ? '▲' : '▼'}</span>
              </button>
              
              {expandedSeccion === sec.value && (
                <div style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px', marginBottom: '8px' }}>
                  {ESQUEMAS.map((esq) => (
                    <button
                      key={esq.value}
                      style={{
                        background: periodoActivo === sec.value && nivelActivo === esq.value ? '#1a7d8c' : '#f1f5f9',
                        color: periodoActivo === sec.value && nivelActivo === esq.value ? '#fff' : '#475569',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: 'none',
                        textAlign: 'left',
                        fontSize: '13px'
                      }}
                      onClick={() => {
                        onSeleccionarEsquema(sec.value, esq.value);
                        setMenuOpen(false); // Cierra el menú al elegir
                      }}
                    >
                      {esq.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="action-row">
        <button
          className={`btn-dictado ${listening ? "listening" : ""}`}
          onClick={onDictadoClick}
        >
          <div className="btn-icon-wrap">
            <MicIcon />
          </div>
          <span className="btn-label">{listening ? "Escuchando…" : "Dictado"}</span>
        </button>

        <button className="btn-texto" onClick={onAbrirTexto}>
          <div className="btn-icon-wrap-light">
            <KeyboardIcon />
          </div>
          <span className="btn-label">Texto</span>
        </button>
      </div>
    </div>
  );
}

export { PERIODO_POR_SECCION };

