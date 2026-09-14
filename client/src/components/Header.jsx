import { useState } from "react";

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

export default function Header({ onLogout }) {
  const [open, setOpen] = useState(false);
  const avatarUrl = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face"; // Placeholder avatar real

  return (
    <header className="pm-header">
      <div className="pm-logo">
        <LogoIcon />
        <span className="pm-logo-text">Planifica<br /><span className="pm-logo-accent">Maestro</span></span>
      </div>
      <div className="pm-header-actions">
        <button className="pm-icon-btn" aria-label="Notificaciones">
          <BellOutlineIcon />
        </button>
        <div style={{position: 'relative'}}>
          <img 
            src={avatarUrl} 
            alt="Perfil" 
            className="pm-avatar" 
            onClick={() => setOpen((o) => !o)}
          />
          {open && (
            <div className="profile-menu" style={{top: '45px', right: '0'}}>
              <button onClick={() => setOpen(false)}>Mi Perfil</button>
              <button onClick={() => setOpen(false)}>Configuración (v2.0)</button>
              <button className="logout-btn" onClick={() => { setOpen(false); onLogout?.(); }}>
                Cerrar Sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

