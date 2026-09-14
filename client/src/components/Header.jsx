import { useState } from "react";

/* Logo SVG — "M" con flecha diagonal integrada, igual al diseño del mockup */
function LogoPM() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Fondo cuadrado redondeado degradado */}
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="34" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2196A8" />
          <stop offset="100%" stopColor="#4ECFB3" />
        </linearGradient>
      </defs>
      <rect width="34" height="34" rx="8" fill="url(#lg)" />
      {/* Letra M blanca */}
      <path
        d="M7 24V10l5 7 5-7v14M17 17l5-7v14"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Flecha diagonal (checkmark / tendencia al alza) */}
      <path
        d="M20 12 L27 12 L27 19"
        stroke="#A8EDDC"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M27 12 L21 18"
        stroke="#A8EDDC"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/* Ícono de campana SVG */
function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export default function Header({ onLogout }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="header">
      {/* ── Logo ── */}
      <div className="header-logo">
        <LogoPM />
        <div className="header-brand">
          <span className="brand-planifica">Planifica</span>
          <span className="brand-maestro">Maestro</span>
        </div>
        <span style={{ 
          background: '#4ECFB3', color: '#12304a', fontSize: '10px', fontWeight: 'bold', 
          padding: '2px 6px', borderRadius: '10px', marginLeft: '4px' 
        }}>
          v2.0
        </span>
      </div>

      {/* ── Acciones ── */}
      <div className="header-actions" onClick={() => setOpen((o) => !o)}>
        <BellIcon />
        <div className="avatar">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
        >
          <path d="M2 4l4 4 4-4" stroke="rgba(255,255,255,0.8)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* ── Dropdown de perfil ── */}
      {open && (
        <div className="profile-menu">
          <button onClick={() => setOpen(false)}>Mi Perfil</button>
          <button onClick={() => setOpen(false)}>Configuración</button>
          <button
            className="logout-btn"
            onClick={() => { setOpen(false); onLogout?.(); }}
          >
            Cerrar Sesión
          </button>
        </div>
      )}
    </div>
  );
}

