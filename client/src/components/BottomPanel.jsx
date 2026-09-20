import { useState, useEffect, useRef } from "react";

/* Ícono menú hamburguesa SVG */
function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

/* Ícono micrófono SVG */
function MicIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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

/* Ícono cámara SVG */
function CameraIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

/* Ícono Calendario */
function CalendarIcon({ color = "#3498DB" }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

/* Ícono Registro de Actividades */
function ClipboardListIcon({ color = "#27AE60" }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="2" />
      <path d="M9 14l2 2 4-4" />
    </svg>
  );
}

/* Ícono Horario Semanal */
function ClockIcon({ color = "#F39C12" }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

/* Ícono Notas de Aula */
function EditIcon({ color = "#9B59B6" }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

/* Ícono Evaluación Diaria */
function CheckCircleIcon({ color = "#C0392B" }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
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
  onAbrirCamara,
  onAbrirEsquemas,
  onAbrirPerfil,
  onAbrirCurriculo,
  onAbrirBiblioteca,
  user,
  onAbrirAuth,
  onLogout,
  menuOpen,
  setMenuOpen
}) {
  
  const [expandedSeccion, setExpandedSeccion] = useState(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [menuOpen, setMenuOpen]);

  const SECCIONES = [
    { label: "Planificación Diaria", value: "diaria", color: "#3498DB" },
    { label: "Planificación Semanal", value: "semanal", color: "#27AE60" },
    { label: "Planificación Mensual", value: "mensual", color: "#F39C12" },
    { label: "Planificación Anual", value: "anual", color: "#9B59B6" },
    { label: "Unidad de Aprendizaje", value: "unidad de aprendizaje", color: "#C0392B" },
    { label: "Proyecto", value: "proyecto", color: "#1ABC9C" }
  ];

  const SUBMENUS_DIARIA = [
    { label: "Plan Diario General", value: "inicial", color: "#3498DB", Icon: CalendarIcon },
    { label: "Registro de Actividades", value: "primario", color: "#27AE60", Icon: ClipboardListIcon },
    { label: "Horario Semanal Detallado", value: "secundario", color: "#F39C12", Icon: ClockIcon },
    { label: "Notas de Aula", value: "conbase", color: "#9B59B6", Icon: EditIcon },
    { label: "Evaluación Diaria", value: "secuencia_didactica", color: "#C0392B", Icon: CheckCircleIcon }
  ];

  const ESQUEMAS = [
    { value: "inicial", label: "Tradicional (Inicial)" },
    { value: "primario", label: "Tradicional (Primario)" },
    { value: "secundario", label: "Tradicional (Secundario)" },
    { value: "especial", label: "Educación Especial" },
    { value: "conbase", label: "Programa 'Con Base'" },
    { value: "abp", label: "Aprendizaje Basado en Proyectos (ABP)" },
    { value: "competencias_situacion", label: "Por Situación de Aprendizaje" },
    { value: "secuencia_didactica", label: "Secuencia Didáctica (Fases detalladas)" }
  ];

  return (
    <>
      {menuOpen && (
        <div
          className="pm-menu-backdrop"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}
      <div className="pm-bottom-bar">
        <div className="pm-menu-dropdown" ref={dropdownRef}>
          <button 
            type="button" 
            className="pm-btn-action pm-btn-menu pm-menu-toggle" 
            onClick={() => setMenuOpen(!menuOpen)}
            title="Abrir menú de opciones"
          >
            <MenuIcon />
            <span>Menú</span>
          </button>
          {menuOpen && (
            <ul className="pm-menu-list">
              {SECCIONES.map((sec) => (
                <li key={sec.value} style={{ marginBottom: '4px' }}>
                  <button
                    className={periodoActivo === sec.value && !expandedSeccion ? "active" : ""}
                    onClick={() => setExpandedSeccion(expandedSeccion === sec.value ? null : sec.value)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '600', color: '#1A2B3C' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span className="pm-menu-dot" style={{ backgroundColor: sec.color }} />
                      <span>{sec.label}</span>
                    </div>
                    <span style={{ fontSize: '10px', marginTop: '2px', color: '#94a3b8' }}>
                      {expandedSeccion === sec.value ? '▼' : '▶'}
                    </span>
                  </button>
                  {expandedSeccion === sec.value && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', paddingLeft: '14px', marginTop: '4px', borderLeft: '2px solid #e2e8f0', marginLeft: '12px' }}>
                      {sec.value === "diaria" ? (
                        SUBMENUS_DIARIA.map((sub) => {
                          const SubIcon = sub.Icon;
                          return (
                            <button
                              key={sub.label}
                              className="pm-submenu-item-btn"
                              onClick={() => {
                                onSeleccionarEsquema("diaria", sub.value);
                                setMenuOpen(false);
                              }}
                            >
                              <span>{sub.label}</span>
                              <SubIcon color={sub.color} />
                            </button>
                          );
                        })
                      ) : (
                        ESQUEMAS.map((esq) => (
                          <button
                            key={esq.value}
                            className={`pm-submenu-item-btn ${periodoActivo === sec.value && nivelActivo === esq.value ? "active" : ""}`}
                            onClick={() => {
                              onSeleccionarEsquema(sec.value, esq.value);
                              setMenuOpen(false);
                            }}
                          >
                            <span>{esq.label}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </li>
              ))}
              <li style={{ marginTop: '8px', borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
                <button
                  style={{ fontWeight: '600', color: '#B45309', display: 'flex', alignItems: 'center' }}
                  onClick={() => { setMenuOpen(false); onAbrirBiblioteca(); }}
                >
                  <span style={{ color: '#F1C40F', marginRight: '8px', filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.1))' }}>📁</span>
                  <span>Mis Planificaciones</span>
                </button>
              </li>
              <li>
                <button
                  style={{ fontWeight: '600', color: 'var(--pm-green, #27AE60)', display: 'flex', alignItems: 'center' }}
                  onClick={() => { setMenuOpen(false); onAbrirEsquemas(); }}
                >
                  <span style={{ marginRight: '8px' }}>📋</span>
                  <span>Ver todos los Esquemas</span>
                </button>
              </li>
              <li>
                <button
                  style={{ fontWeight: '600', color: 'var(--pm-navy, #1B3A5C)', display: 'flex', alignItems: 'center' }}
                  onClick={() => { setMenuOpen(false); onAbrirPerfil(); }}
                >
                  <span style={{ marginRight: '8px' }}>👤</span>
                  <span>Mi Perfil</span>
                </button>
              </li>
              <li>
                <button
                  style={{ fontWeight: '600', color: '#1a7d8c', display: 'flex', alignItems: 'center' }}
                  onClick={() => { setMenuOpen(false); onAbrirCurriculo(); }}
                >
                  <span style={{ marginRight: '8px' }}>📚</span>
                  <span>Currículo MINERD</span>
                </button>
              </li>
              <li style={{ marginTop: '4px', borderTop: '1px solid #f1f5f9', paddingTop: '4px' }}>
                {user ? (
                  <button
                    style={{ fontWeight: '700', color: '#dc2626' }}
                    onClick={() => { setMenuOpen(false); onLogout?.(); }}
                  >
                    🚪 Cerrar Sesión
                  </button>
                ) : (
                  <button
                    style={{ fontWeight: '700', color: '#1a7d8c' }}
                    onClick={() => { setMenuOpen(false); onAbrirAuth?.(); }}
                  >
                    🔐 Iniciar Sesión / Registrarse
                  </button>
                )}
              </li>
              <li style={{ marginTop: '6px', borderTop: '1px solid #f1f5f9', paddingTop: '6px', textAlign: 'center' }}>
                <span style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '0.02em', display: 'block' }}>
                  v{(() => {
                    try {
                      const raw = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '';
                      if (!raw) return '1.0.0';
                      const d = new Date(raw);
                      if (isNaN(d.getTime())) return raw;
                      const dia = String(d.getDate()).padStart(2, '0');
                      const mes = String(d.getMonth() + 1).padStart(2, '0');
                      const anio = d.getFullYear();
                      const hh = String(d.getHours()).padStart(2, '0');
                      const mm = String(d.getMinutes()).padStart(2, '0');
                      return `${dia}/${mes}/${anio} ${hh}:${mm}`;
                    } catch {
                      return '1.0.0';
                    }
                  })()}
                </span>
              </li>
            </ul>
          )}
        </div>
        
        <button 
          type="button"
          className="pm-btn-action pm-btn-foto" 
          onClick={() => { setMenuOpen(false); onAbrirCamara?.(); }}
          title="Tomar o subir foto de material docente"
        >
          <CameraIcon />
          <span>Foto</span>
        </button>

        <button 
          type="button"
          className={`pm-btn-action pm-btn-dictado ${listening ? "listening" : ""}`} 
          onClick={() => { setMenuOpen(false); onDictadoClick?.(); }}
          title="Dictar tema de planificación por voz"
        >
          <MicIcon />
          <span>{listening ? "Escuchando..." : "Voz"}</span>
        </button>
        
        <button 
          type="button"
          className="pm-btn-action pm-btn-texto" 
          onClick={() => { setMenuOpen(false); onAbrirTexto?.(); }}
          title="Escribir tema o competencias con el teclado"
        >
          <KeyboardIcon />
          <span>Texto</span>
        </button>
      </div>
    </>
  );
}
