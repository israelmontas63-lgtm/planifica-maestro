import { useState } from "react";

const ACCESS_KEY_STORAGE = "pm_institutional_access_unlocked";
const VALID_PASSWORDS = ["minerd2026", "MINERD2026", "maestro2026"];

export function verificarAccesoAutorizado() {
  try {
    return localStorage.getItem(ACCESS_KEY_STORAGE) === "true";
  } catch (e) {
    return false;
  }
}

export default function AccessGate({ onUnlock }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (VALID_PASSWORDS.includes(password.trim())) {
      try {
        localStorage.setItem(ACCESS_KEY_STORAGE, "true");
      } catch (e) {}
      setError(false);
      onUnlock();
    } else {
      setError(true);
    }
  };

  return (
    <div className="access-gate-overlay">
      <div className="access-gate-card">
        <div className="access-gate-header">
          <div className="access-gate-badge">MINERD • Planifica Maestro</div>
          <h2>🔒 Acceso Protegido</h2>
          <p>Esta versión piloto requiere una clave institucional compartida para ingresar.</p>
        </div>

        <form onSubmit={handleSubmit} className="access-gate-form">
          <label className="access-gate-label">
            Clave de Acceso
            <input
              type="password"
              className="access-gate-input"
              placeholder="Introduce la contraseña"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(false); }}
              autoFocus
            />
          </label>

          {error && (
            <div className="access-gate-error">
              ⚠️ Clave incorrecta. Introduce la clave oficial (ej. MINERD2026).
            </div>
          )}

          <button type="submit" className="access-gate-btn">
            Entrar a la Aplicación
          </button>
        </form>

        <div className="access-gate-footer">
          <span>Sistema de Planificación Curricular Dominicano • v2.0</span>
        </div>
      </div>
    </div>
  );
}
