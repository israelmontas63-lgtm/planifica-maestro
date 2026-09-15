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
  menuOpen,
  setMenuOpen
}) {
  
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
    <div className="pm-bottom-bar">
      <div className="pm-menu-dropdown">
        <button className="pm-menu-toggle" onClick={() => setMenuOpen(!menuOpen)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
          Menú
        </button>
        {menuOpen && (
          <ul className="pm-menu-list">
            {SECCIONES.map((sec) => (
              <li key={sec.value} style={{ marginBottom: '4px' }}>
                <button
                  className={periodoActivo === sec.value && !expandedSeccion ? "active" : ""}
                  onClick={() => setExpandedSeccion(expandedSeccion === sec.value ? null : sec.value)}
                  style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600' }}
                >
                  <span>{sec.label}</span>
                  <span style={{ fontSize: '10px', marginTop: '2px' }}>{expandedSeccion === sec.value ? '▲' : '▼'}</span>
                </button>
                {expandedSeccion === sec.value && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '10px', marginTop: '4px' }}>
                    {ESQUEMAS.map((esq) => (
                      <button
                        key={esq.value}
                        className={periodoActivo === sec.value && nivelActivo === esq.value ? "active" : ""}
                        style={{ fontSize: '12px', padding: '8px', borderRadius: '4px' }}
                        onClick={() => {
                          onSeleccionarEsquema(sec.value, esq.value);
                          setMenuOpen(false);
                        }}
                      >
                        {esq.label}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      
      <button 
        className={`pm-btn-dictado ${listening ? "listening" : ""}`} 
        onClick={onDictadoClick}
      >
        <MicIcon />
        {listening ? "Escuchando…" : "Dictado"}
      </button>
      
      <button className="pm-btn-texto" onClick={onAbrirTexto}>
        <KeyboardIcon />
        Texto
      </button>
    </div>
  );
}

export { PERIODO_POR_SECCION };


