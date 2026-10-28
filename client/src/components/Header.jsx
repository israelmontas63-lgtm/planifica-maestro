import { useState, useRef, useEffect } from "react";
import { isAuthEnabled } from "../services/supabaseClient.js";
import { cargarPerfil } from "../services/perfilStorage.js";

function LogoIcon() {
  return (
    <svg className="pm-logo-icon" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="34" height="34" rx="8" fill="#4ECFB3" />
      <path d="M7 24V10l5 7 5-7v14M17 17l5-7v14" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BellOutlineIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export default function Header({ 
  user, 
  isOwner, 
  onLogout, 
  onLogoutOwner, 
  onAbrirPerfil, 
  onAbrirAuth, 
  onAbrirOwnerModal, 
  onAbrirOwnerStats, 
  onAbrirCoordinacion,
  estadoCuota,
  onInstallApp,
  onAbrirNotificaciones,
  onAbrirConfiguracion,
  onAbrirAcerca,
  contadorNotificaciones = 0,
  onAbrirMenuSheet
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef(null);

  // Gesto de 3 toques en el logo para abrir el diálogo de Llave Maestra
  const handleLogoClick = () => {
    clickCountRef.current += 1;
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);

    if (clickCountRef.current >= 3) {
      clickCountRef.current = 0;
      onAbrirOwnerModal?.();
    } else {
      clickTimerRef.current = setTimeout(() => {
        clickCountRef.current = 0;
      }, 700);
    }
  };

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [open]);

  const localPerfil = open ? (cargarPerfil() || {}) : {};
  const nombre = user?.user_metadata?.nombre || user?.user_metadata?.full_name || localPerfil.nombre || "";
  const escuela = user?.user_metadata?.escuela || localPerfil.escuela || "";
  const email = user?.email || "";
  const avatarUrl = user?.user_metadata?.avatar_url || null;
  const userRol = user?.user_metadata?.rol || localPerfil.rol || "docente";
  const esSupervisor = isOwner || userRol === "coordinador_area" || userRol === "director" || userRol === "admin";

  // Cálculo de iniciales dinámicas para usuario autenticado
  const getInitials = () => {
    if (nombre && nombre.trim()) {
      const clean = nombre.trim().replace(/^(Lic\.|Prof\.|Dr\.|Dra\.|Ing\.)\s+/i, "");
      const parts = clean.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      if (parts.length === 1) {
        return parts[0].substring(0, 2).toUpperCase();
      }
    }
    if (email && email.trim()) {
      return email.substring(0, 2).toUpperCase();
    }
    return "PM";
  };

  return (
    <header className="pm-header">
      {/* Logo con detector secreto de 3 toques */}
      <div 
        className="pm-logo" 
        onClick={handleLogoClick}
        style={{ cursor: "pointer", userSelect: "none" }}
        title="Planifica Maestro"
      >
        <LogoIcon />
        <span className="pm-logo-text">Planifica<br /><span className="pm-logo-accent">Maestro</span></span>
      </div>

      <div className="pm-header-actions">
        {/* Badge de cuota: Ilimitada si es Owner, o contador normal */}
        {isOwner ? (
          <div 
            className="pm-cuota-badge pm-cuota-owner"
            title="Cuota de Propietario: Ilimitada (Acceso Maestro)"
            style={{ background: "#d97706", borderColor: "#f59e0b", color: "#fff" }}
          >
            <span className="pm-cuota-icon">👑</span>
            <span className="pm-cuota-text">∞</span>
          </div>
        ) : estadoCuota && (
          <div 
            className={`pm-cuota-badge ${estadoCuota.agotado ? 'cuota-agotada' : estadoCuota.alerta80 ? 'cuota-alerta' : ''}`}
            title={`Cuota de hoy: ${estadoCuota.usadas}/${estadoCuota.limite} planes generados. Se reinicia a medianoche.`}
          >
            <span className="pm-cuota-icon">⚡</span>
            <span className="pm-cuota-text">Cuota de hoy: {estadoCuota.usadas}/{estadoCuota.limite} planes</span>
          </div>
        )}

        <button 
          type="button"
          className="pm-icon-btn" 
          aria-label={contadorNotificaciones > 0 ? `${contadorNotificaciones} notificaciones pendientes` : "Notificaciones"} 
          title={contadorNotificaciones > 0 ? `${contadorNotificaciones} notificaciones del sistema y dictámenes pendientes` : "Notificaciones del sistema"}
          onClick={onAbrirNotificaciones}
        >
          <BellOutlineIcon />
          {contadorNotificaciones > 0 && (
            <span className="pm-notif-badge">
              {contadorNotificaciones > 9 ? "9+" : contadorNotificaciones}
            </span>
          )}
        </button>

        {/* Botón visible de Iniciar Sesión solo cuando la autenticación está activa */}
        {!user && !isOwner && isAuthEnabled && (
          <button
            type="button"
            className="pm-btn-login-header"
            onClick={onAbrirAuth}
            title="Iniciar sesión o crear cuenta"
          >
            <span style={{ fontSize: '13px' }}>🔐</span>
            <span>Entrar</span>
          </button>
        )}

        {/* Avatar dinámico: Dueño 👑 | Usuario Supabase 👤 | Invitado 👩‍🏫 */}
        <div style={{ position: 'relative' }} ref={menuRef}>
          <button
            type="button"
            className="pm-avatar-btn"
            onClick={() => {
              if (onAbrirMenuSheet) {
                onAbrirMenuSheet();
              } else {
                setOpen((o) => !o);
              }
            }}
            title={
              isOwner 
                ? "👑 Modo Propietario (Acceso Ilimitado)" 
                : user 
                  ? (nombre ? `${nombre} (${email})` : email) 
                  : "Toca aquí para Iniciar Sesión o Registrarte"
            }
            aria-label="Menú de usuario"
          >
            {isOwner ? (
              <div 
                className="pm-avatar-initials" 
                style={{ background: "linear-gradient(135deg, #d97706 0%, #b45309 100%)", border: "2px solid #f59e0b", fontSize: "16px" }}
              >
                👑
              </div>
            ) : user ? (
              avatarUrl ? (
                <img src={avatarUrl} alt={nombre || "Perfil"} className="pm-avatar-img" />
              ) : (
                <div className="pm-avatar-initials">
                  {getInitials()}
                </div>
              )
            ) : (
              <div className="pm-avatar-guest" title="Modo Abierto - Toca para Iniciar Sesión">
                👩‍🏫
              </div>
            )}
          </button>

          {open && (
            <div className="profile-menu pm-profile-menu-dropdown" style={{ top: '45px', right: '0' }}>
              {isOwner ? (
                /* Menú para MODO PROPIETARIO */
                <>
                  <div className="pm-user-info-banner" style={{ background: "#fffbeb", borderBottomColor: "#fef3c7" }}>
                    <div className="pm-user-avatar-mini" style={{ background: "#d97706" }}>
                      👑
                    </div>
                    <div className="pm-user-details">
                      <span className="pm-user-name" style={{ color: "#92400e" }}>Propietario / Admin</span>
                      <span className="pm-user-email">Acceso Maestro • Cuota ∞</span>
                    </div>
                  </div>

                  <div className="pm-profile-menu-items">
                    <button
                      type="button"
                      style={{ fontWeight: "700", color: "#d97706", background: "#fefce8" }}
                      onClick={() => { setOpen(false); onAbrirOwnerStats?.(); }}
                    >
                      📊 Estado del Sistema (Métricas)
                    </button>
                    <button
                      type="button"
                      style={{ color: "#0f766e", fontWeight: "700", background: "#f0fdfa" }}
                      onClick={() => { setOpen(false); onAbrirCoordinacion?.(); }}
                    >
                      📋 Panel de Coordinación
                    </button>
                    <button
                      type="button"
                      onClick={() => { setOpen(false); onAbrirPerfil?.(); }}
                    >
                      👤 Perfil del Docente
                    </button>
                    {onInstallApp && (
                      <button
                        type="button"
                        style={{ color: "#0d9488", fontWeight: "600", background: "#f0fdfa" }}
                        onClick={() => { setOpen(false); onInstallApp(); }}
                      >
                        📲 Instalar Aplicación PWA
                      </button>
                    )}
                    <button
                      type="button"
                      className="logout-btn"
                      onClick={() => { setOpen(false); onLogoutOwner?.(); }}
                    >
                      🚪 Salir de Modo Propietario
                    </button>
                  </div>
                </>
              ) : user ? (
                /* Menú para usuario que SÍ ha iniciado sesión */
                <>
                  <div className="pm-user-info-banner">
                    <div className="pm-user-avatar-mini">
                      {getInitials()}
                    </div>
                    <div className="pm-user-details">
                      <span className="pm-user-name">{nombre || "Docente"}</span>
                      <span className="pm-user-email">{email}</span>
                      {escuela && <span className="pm-user-school">🏫 {escuela}</span>}
                    </div>
                  </div>

                  <div className="pm-profile-menu-items">
                    {esSupervisor && (
                      <button
                        type="button"
                        style={{ color: "#0f766e", fontWeight: "700", background: "#f0fdfa" }}
                        onClick={() => { setOpen(false); onAbrirCoordinacion?.(); }}
                      >
                        📋 Panel de Coordinación
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => { setOpen(false); onAbrirPerfil?.(); }}
                    >
                      👤 Mi Perfil Docente
                    </button>
                    {onInstallApp && (
                      <button
                        type="button"
                        style={{ color: "#0d9488", fontWeight: "600", background: "#f0fdfa" }}
                        onClick={() => { setOpen(false); onInstallApp(); }}
                      >
                        📲 Instalar Aplicación PWA
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => { setOpen(false); onAbrirConfiguracion?.(); }}
                    >
                      ⚙️ Configuración (v2.0)
                    </button>
                    {onAbrirAcerca && (
                      <button
                        type="button"
                        onClick={() => { setOpen(false); onAbrirAcerca?.(); }}
                      >
                        🔄 Acerca de y actualización
                      </button>
                    )}
                    <button
                      type="button"
                      className="logout-btn"
                      onClick={() => { setOpen(false); onLogout?.(); }}
                    >
                      🚪 Cerrar Sesión
                    </button>
                  </div>
                </>
              ) : (
                /* Menú para usuario en modo Beta Abierta / sin sesión en la nube */
                <>
                  <div className="pm-user-info-banner">
                    <div className="pm-user-avatar-mini" style={{ background: '#1a7d8c' }}>
                      👩‍🏫
                    </div>
                    <div className="pm-user-details">
                      <span className="pm-user-name">{nombre || "Mi Espacio Docente"}</span>
                      <span className="pm-user-email">{escuela || "Planificación en este dispositivo"}</span>
                    </div>
                  </div>

                  <div className="pm-profile-menu-items">
                    {isAuthEnabled && (
                      <button
                        type="button"
                        style={{ fontWeight: '700', color: '#1a7d8c', background: '#f0fdfa' }}
                        onClick={() => { setOpen(false); onAbrirAuth?.(); }}
                      >
                        🔐 Iniciar Sesión / Registrarse
                      </button>
                    )}
                    {esSupervisor && (
                      <button
                        type="button"
                        style={{ color: "#0f766e", fontWeight: "700", background: "#f0fdfa" }}
                        onClick={() => { setOpen(false); onAbrirCoordinacion?.(); }}
                      >
                        📋 Panel de Coordinación
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => { setOpen(false); onAbrirPerfil?.(); }}
                    >
                      👤 Perfil del Docente
                    </button>
                    {onInstallApp && (
                      <button
                        type="button"
                        style={{ color: "#0d9488", fontWeight: "600", background: "#f0fdfa" }}
                        onClick={() => { setOpen(false); onInstallApp(); }}
                      >
                        📲 Instalar Aplicación PWA
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => { setOpen(false); onAbrirConfiguracion?.(); }}
                    >
                      ⚙️ Configuración (v2.0)
                    </button>
                    {onAbrirAcerca && (
                      <button
                        type="button"
                        onClick={() => { setOpen(false); onAbrirAcerca?.(); }}
                      >
                        🔄 Acerca de y actualización
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
