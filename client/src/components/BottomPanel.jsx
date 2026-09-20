import { useState, useEffect, useRef } from "react";

/* ── ÍCONOS DE LA BARRA INFERIOR (Acción rápida) ── */
function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

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

function CameraIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

/* ── ÍCONO DE ESCUELA (Encabezado) ── */
function SchoolIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m4 6 8-4 8 4" />
      <path d="m18 10 4 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8l4-2" />
      <path d="M14 22v-4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v4" />
      <path d="M18 5v17" />
      <path d="M6 5v17" />
      <circle cx="12" cy="9" r="2" />
    </svg>
  );
}

/* ── ÍCONOS VECTORIALES DE SECCIONES (Planificación) ── */
function DailyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <circle cx="12" cy="15" r="2" />
    </svg>
  );
}

function WeeklyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
      <path d="M15 3v18" />
      <path d="M3 9h18" />
    </svg>
  );
}

function MonthlyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 14h.01" />
      <path d="M12 14h.01" />
      <path d="M16 14h.01" />
      <path d="M8 18h.01" />
      <path d="M12 18h.01" />
    </svg>
  );
}

function AnnualIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="M7 16l3-3 3 2 4-5" />
      <polyline points="14 10 17 10 17 13" />
    </svg>
  );
}

function UnitIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M9 7h6" />
      <path d="M9 11h6" />
    </svg>
  );
}

function ProjectIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
      <path d="M9 18h6" />
      <path d="M10 22h4" />
    </svg>
  );
}

/* ── ÍCONOS VECTORIALES DE "MI ESPACIO" Y "CUENTA Y APP" (Sin emojis) ── */
function FolderIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ClipboardCheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M9 12h6" />
      <path d="M9 16h6" />
    </svg>
  );
}

function BookOpenIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function HelpCircleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function CrownIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
    </svg>
  );
}

function LogOutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

/* ── CONFIGURACIÓN CENTRALIZADA DE SECCIONES (Colores e Íconos) ── */
const SECCIONES_PLANIFICACION = [
  {
    key: "diaria",
    periodoValue: "diaria",
    label: "Planificación diaria",
    cssVar: "diaria",
    Icon: DailyIcon,
    subitems: [
      { label: "Plan diario general", isGeneral: true },
      { label: "Registro de actividades", isGeneral: false },
      { label: "Horario semanal detallado", isGeneral: false },
      { label: "Notas de aula", isGeneral: false },
      { label: "Evaluación diaria", isGeneral: false }
    ]
  },
  {
    key: "semanal",
    periodoValue: "semanal",
    label: "Planificación semanal",
    cssVar: "semanal",
    Icon: WeeklyIcon,
    subitems: [
      { label: "Plan semanal general", isGeneral: true },
      { label: "Distribución por áreas", isGeneral: false },
      { label: "Actividades de la semana", isGeneral: false },
      { label: "Recursos y materiales", isGeneral: false }
    ]
  },
  {
    key: "mensual",
    periodoValue: "mensual",
    label: "Planificación mensual",
    cssVar: "mensual",
    Icon: MonthlyIcon,
    subitems: [
      { label: "Plan mensual general", isGeneral: true },
      { label: "Calendario del mes", isGeneral: false },
      { label: "Competencias del mes", isGeneral: false }
    ]
  },
  {
    key: "anual",
    periodoValue: "anual",
    label: "Planificación anual",
    cssVar: "anual",
    Icon: AnnualIcon,
    subitems: [
      { label: "Plan anual general", isGeneral: true },
      { label: "Distribución por períodos", isGeneral: false },
      { label: "Proyección del año", isGeneral: false }
    ]
  },
  {
    key: "unidad",
    periodoValue: "unidad de aprendizaje",
    label: "Unidad de aprendizaje",
    cssVar: "unidad",
    Icon: UnitIcon,
    subitems: [
      { label: "Nueva unidad", isGeneral: true },
      { label: "Situación de aprendizaje", isGeneral: false },
      { label: "Competencias e indicadores", isGeneral: false },
      { label: "Secuencia de actividades", isGeneral: false },
      { label: "Evaluación de la unidad", isGeneral: false }
    ]
  },
  {
    key: "proyecto",
    periodoValue: "proyecto",
    label: "Proyecto",
    cssVar: "proyecto",
    Icon: ProjectIcon,
    subitems: [
      { label: "Nuevo proyecto", isGeneral: true },
      { label: "Proyecto de aula", isGeneral: false },
      { label: "Proyecto institucional", isGeneral: false },
      { label: "Evaluación del proyecto", isGeneral: false }
    ]
  }
];

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
  setMenuOpen,
  isOwner,
  onAbrirOwner,
  canInstall,
  onInstallApp
}) {
  // Acordeón: solo una sección abierta a la vez. Abierta al cargar: diaria
  const [openSection, setOpenSection] = useState("diaria");
  const [toastMsg, setToastMsg] = useState(null);
  const dropdownRef = useRef(null);

  // Cerrar menú al hacer clic fuera
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

  const handleToggleSection = (sectionKey) => {
    setOpenSection((prev) => (prev === sectionKey ? null : sectionKey));
  };

  const handleProximamente = (nombre) => {
    setToastMsg(`ℹ️ "${nombre}" estará disponible próximamente en una siguiente actualización.`);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleSubmenuClick = (sec, sub) => {
    if (sub.isGeneral) {
      onSeleccionarEsquema(sec.periodoValue, nivelActivo || "primario");
      setMenuOpen(false);
      onAbrirTexto?.();
    } else {
      handleProximamente(sub.label);
    }
  };

  return (
    <>
      {menuOpen && (
        <div
          className="pm-menu-backdrop"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {toastMsg && (
        <div className="pm-toast" role="alert">
          <span>{toastMsg}</span>
        </div>
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
            <div className="pm-menu-list" role="menu">
              
              {/* 1. ENCABEZADO: Ícono escuela + "Planifica Maestro" */}
              <div className="pm-menu-header">
                <div className="pm-menu-header-icon">
                  <SchoolIcon />
                </div>
                <div>
                  <h2 className="pm-menu-header-title">Planifica Maestro</h2>
                  <p className="pm-menu-header-subtitle">Planificación curricular MINERD</p>
                </div>
              </div>

              {/* CONTENIDO CON SCROLL */}
              <div className="pm-menu-scroll">

                {/* 2. GRUPO: PLANIFICACIÓN (ACORDEÓN) */}
                <div className="pm-menu-group">
                  <div className="pm-menu-group-title">Planificación</div>
                  
                  {SECCIONES_PLANIFICACION.map((sec) => {
                    const isOpen = openSection === sec.key;
                    const SecIcon = sec.Icon;
                    const borderVar = `var(--sec-${sec.cssVar}-border)`;
                    const bgVar = `var(--sec-${sec.cssVar}-bg)`;
                    const textVar = `var(--sec-${sec.cssVar}-text)`;

                    return (
                      <div
                        key={sec.key}
                        className="pm-accordion-item"
                        style={{ borderColor: borderVar }}
                      >
                        {/* Cabecera de la sección (min 48px) */}
                        <button
                          type="button"
                          className="pm-accordion-btn pm-touch-row"
                          style={{
                            backgroundColor: bgVar,
                            color: textVar
                          }}
                          onClick={() => handleToggleSection(sec.key)}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <SecIcon />
                            <span>{sec.label}</span>
                          </div>
                          <span style={{ fontSize: "11px", fontWeight: "bold" }}>
                            {isOpen ? "▼" : "▶"}
                          </span>
                        </button>

                        {/* Submenú desplegable */}
                        {isOpen && (
                          <div
                            className="pm-submenu-tree"
                            style={{ borderColor: borderVar }}
                          >
                            {sec.subitems.map((sub) => {
                              const isSubActive =
                                sub.isGeneral &&
                                (periodoActivo === sec.periodoValue ||
                                  (sec.key === "diaria" && periodoActivo === "diaria"));

                              return (
                                <button
                                  key={sub.label}
                                  type="button"
                                  className={`pm-submenu-item pm-touch-row ${
                                    isSubActive ? "active" : sub.isGeneral ? "" : "proximamente"
                                  }`}
                                  style={
                                    isSubActive
                                      ? {
                                          backgroundColor: bgVar,
                                          color: textVar
                                        }
                                      : {}
                                  }
                                  onClick={() => handleSubmenuClick(sec, sub)}
                                >
                                  <span>{sub.label}</span>
                                  {isSubActive ? (
                                    <span
                                      style={{
                                        fontSize: "10px",
                                        fontWeight: "700",
                                        textTransform: "uppercase",
                                        padding: "2px 6px",
                                        borderRadius: "4px",
                                        backgroundColor: borderVar,
                                        color: "#ffffff"
                                      }}
                                    >
                                      Activo
                                    </span>
                                  ) : !sub.isGeneral ? (
                                    <span className="pm-badge-prox">Próximamente</span>
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 3. GRUPO: MI ESPACIO (Filas simples con íconos SVG) */}
                <div className="pm-menu-group" style={{ paddingTop: "6px", borderTop: "1px solid var(--pm-menu-separator)" }}>
                  <div className="pm-menu-group-title">Mi espacio</div>

                  {/* Mis planificaciones */}
                  <button
                    type="button"
                    className="pm-link-row pm-touch-row"
                    onClick={() => {
                      setMenuOpen(false);
                      onAbrirBiblioteca?.();
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <div className="pm-link-icon-box" style={{ backgroundColor: "rgba(241, 196, 15, 0.15)", color: "#b45309" }}>
                        <FolderIcon />
                      </div>
                      <span>Mis planificaciones</span>
                    </div>
                  </button>

                  {/* Esquemas */}
                  <button
                    type="button"
                    className="pm-link-row pm-touch-row"
                    onClick={() => {
                      setMenuOpen(false);
                      onAbrirEsquemas?.();
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <div className="pm-link-icon-box" style={{ backgroundColor: "rgba(39, 174, 96, 0.15)", color: "#27ae60" }}>
                        <ClipboardCheckIcon />
                      </div>
                      <span>Esquemas</span>
                    </div>
                  </button>

                  {/* Currículo MINERD */}
                  <button
                    type="button"
                    className="pm-link-row pm-touch-row"
                    onClick={() => {
                      setMenuOpen(false);
                      onAbrirCurriculo?.();
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <div className="pm-link-icon-box" style={{ backgroundColor: "rgba(26, 125, 140, 0.15)", color: "#1a7d8c" }}>
                        <BookOpenIcon />
                      </div>
                      <span>Currículo MINERD</span>
                    </div>
                  </button>

                  {/* Mi perfil */}
                  <button
                    type="button"
                    className="pm-link-row pm-touch-row"
                    onClick={() => {
                      setMenuOpen(false);
                      onAbrirPerfil?.();
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <div className="pm-link-icon-box" style={{ backgroundColor: "rgba(27, 58, 92, 0.15)", color: "#1B3A5C" }}>
                        <UserIcon />
                      </div>
                      <span>Mi perfil</span>
                    </div>
                  </button>
                </div>

                {/* 4. GRUPO: CUENTA Y APP */}
                <div className="pm-menu-group" style={{ paddingTop: "6px", borderTop: "1px solid var(--pm-menu-separator)" }}>
                  <div className="pm-menu-group-title">Cuenta y app</div>

                  {/* Instalar aplicación (PWA Condicional) */}
                  {canInstall && (
                    <button
                      type="button"
                      className="pm-link-row pm-touch-row"
                      style={{ color: "var(--teal, #1a7d8c)" }}
                      onClick={() => {
                        setMenuOpen(false);
                        onInstallApp?.();
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <div className="pm-link-icon-box" style={{ backgroundColor: "rgba(26, 125, 140, 0.15)", color: "#1a7d8c" }}>
                          <DownloadIcon />
                        </div>
                        <span>Instalar aplicación</span>
                      </div>
                    </button>
                  )}

                  {/* Ajustes */}
                  <button
                    type="button"
                    className="pm-link-row pm-touch-row"
                    onClick={() => handleProximamente("Ajustes")}
                  >
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <div className="pm-link-icon-box" style={{ backgroundColor: "rgba(100, 116, 139, 0.15)", color: "#64748b" }}>
                        <SettingsIcon />
                      </div>
                      <span>Ajustes</span>
                    </div>
                    <span className="pm-badge-prox">Próximamente</span>
                  </button>

                  {/* Ayuda */}
                  <button
                    type="button"
                    className="pm-link-row pm-touch-row"
                    onClick={() => handleProximamente("Centro de Ayuda y Tutoriales")}
                  >
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <div className="pm-link-icon-box" style={{ backgroundColor: "rgba(14, 165, 233, 0.15)", color: "#0ea5e9" }}>
                        <HelpCircleIcon />
                      </div>
                      <span>Ayuda</span>
                    </div>
                    <span className="pm-badge-prox">Próximamente</span>
                  </button>

                  {/* Panel Propietario (Condicional) */}
                  {isOwner && (
                    <button
                      type="button"
                      className="pm-link-row pm-touch-row"
                      style={{ color: "#7c3aed" }}
                      onClick={() => {
                        setMenuOpen(false);
                        onAbrirOwner?.();
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <div className="pm-link-icon-box" style={{ backgroundColor: "rgba(124, 58, 237, 0.15)", color: "#7c3aed" }}>
                          <CrownIcon />
                        </div>
                        <span>Panel Propietario</span>
                      </div>
                    </button>
                  )}

                  {/* Botón con Borde: Iniciar sesión / Cerrar sesión */}
                  <div style={{ paddingTop: "6px" }}>
                    {user ? (
                      <button
                        type="button"
                        className="pm-auth-logout-btn pm-touch-row"
                        onClick={() => {
                          setMenuOpen(false);
                          onLogout?.();
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", textAlign: "left" }}>
                          <span style={{ fontSize: "11px", opacity: 0.8 }}>Sesión activa</span>
                          <span style={{ fontWeight: "700", fontSize: "13.5px" }}>
                            {user.user_metadata?.nombre ||
                              user.user_metadata?.full_name ||
                              user.email?.split("@")[0] ||
                              "Docente"}
                          </span>
                        </div>
                        <span style={{ fontSize: "12px", fontWeight: "600", padding: "4px 8px", borderRadius: "6px", backgroundColor: "rgba(185, 28, 28, 0.1)", display: "flex", alignItems: "center", gap: "4px" }}>
                          <span>Cerrar sesión</span>
                          <LogOutIcon />
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="pm-auth-btn pm-touch-row"
                        onClick={() => {
                          setMenuOpen(false);
                          onAbrirAuth?.();
                        }}
                      >
                        <span>Iniciar sesión / registrarse</span>
                      </button>
                    )}
                  </div>
                </div>

              </div>

              {/* 5. PIE: Versión y Fecha/Hora de build generada por Vite en zona horaria America/Santo_Domingo */}
              <div className="pm-menu-footer">
                v{(() => {
                  try {
                    const raw = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "";
                    if (!raw) return "19/09/2026 22:20";
                    const d = new Date(raw);
                    if (isNaN(d.getTime())) return raw;
                    const formatter = new Intl.DateTimeFormat("es-DO", {
                      timeZone: "America/Santo_Domingo",
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false
                    });
                    const p = {};
                    formatter.formatToParts(d).forEach(({ type, value }) => {
                      p[type] = value;
                    });
                    return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
                  } catch {
                    return "19/09/2026 22:20";
                  }
                })()}
              </div>

            </div>
          )}
        </div>

        {/* ── BOTONES DE ACCIÓN RÁPIDA (Intactos) ── */}
        <button
          type="button"
          className="pm-btn-action pm-btn-foto"
          onClick={() => {
            setMenuOpen(false);
            onAbrirCamara?.();
          }}
          title="Tomar o subir foto de material docente"
        >
          <CameraIcon />
          <span>Foto</span>
        </button>

        <button
          type="button"
          className={`pm-btn-action pm-btn-dictado ${listening ? "listening" : ""}`}
          onClick={() => {
            setMenuOpen(false);
            onDictadoClick?.();
          }}
          title="Dictar tema de planificación por voz"
        >
          <MicIcon />
          <span>{listening ? "Escuchando..." : "Voz"}</span>
        </button>

        <button
          type="button"
          className="pm-btn-action pm-btn-texto"
          onClick={() => {
            setMenuOpen(false);
            onAbrirTexto?.();
          }}
          title="Escribir tema o competencias con el teclado"
        >
          <KeyboardIcon />
          <span>Texto</span>
        </button>
      </div>
    </>
  );
}
