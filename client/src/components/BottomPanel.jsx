import { useState, useEffect, useRef } from "react";

/* ── ÍCONOS DE LA BARRA INFERIOR (Sin cambios) ── */
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

/* ── ÍCONOS DE CADA SECCIÓN DE PLANIFICACIÓN ── */
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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
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
              
              {/* 1. ENCABEZADO */}
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

                {/* 3. GRUPO: MI ESPACIO */}
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
                        <span style={{ fontSize: "16px" }}>📁</span>
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
                        <span style={{ fontSize: "16px" }}>📋</span>
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
                        <span style={{ fontSize: "16px" }}>📚</span>
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
                        <span style={{ fontSize: "16px" }}>👤</span>
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
                          <span style={{ fontSize: "16px" }}>📲</span>
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
                        <span style={{ fontSize: "16px" }}>⚙️</span>
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
                        <span style={{ fontSize: "16px" }}>❓</span>
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
                          <span style={{ fontSize: "16px" }}>👑</span>
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
                        <span style={{ fontSize: "12px", fontWeight: "600", padding: "4px 8px", borderRadius: "6px", backgroundColor: "rgba(185, 28, 28, 0.1)" }}>
                          Cerrar sesión 🚪
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

              {/* 5. PIE: Versión y Fecha/Hora de build */}
              <div className="pm-menu-footer">
                v{(() => {
                  try {
                    const raw = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "";
                    if (!raw) return "19/09/2026 22:20";
                    const d = new Date(raw);
                    if (isNaN(d.getTime())) return raw;
                    const dia = String(d.getDate()).padStart(2, "0");
                    const mes = String(d.getMonth() + 1).padStart(2, "0");
                    const anio = d.getFullYear();
                    const hh = String(d.getHours()).padStart(2, "0");
                    const mm = String(d.getMinutes()).padStart(2, "0");
                    return `${dia}/${mes}/${anio} ${hh}:${mm}`;
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
