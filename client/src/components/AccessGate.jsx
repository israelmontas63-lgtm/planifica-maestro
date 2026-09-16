import { useState } from "react";

const AUTH_TOKEN_STORAGE = "pm_auth_token";

export function obtenerAuthToken() {
  try {
    return localStorage.getItem(AUTH_TOKEN_STORAGE) || "";
  } catch (e) {
    return "";
  }
}

export function verificarAccesoAutorizado() {
  try {
    const token = localStorage.getItem(AUTH_TOKEN_STORAGE);
    return Boolean(token && token.trim().length > 0);
  } catch (e) {
    return false;
  }
}

export function cerrarAcceso() {
  try {
    localStorage.removeItem(AUTH_TOKEN_STORAGE);
  } catch (e) {}
}

export default function AccessGate({ onUnlock }) {
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState(null);
  const [verificando, setVerificando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) return;

    setVerificando(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.trim() })
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.ok && data.token) {
        localStorage.setItem(AUTH_TOKEN_STORAGE, data.token);
        setErrorMsg(null);
        onUnlock();
      } else {
        setErrorMsg(data.error || "Clave institucional incorrecta.");
      }
    } catch (err) {
      setErrorMsg("Error de conexión al servidor de validación.");
    } finally {
      setVerificando(false);
    }
  };

  return (
    <div className="access-gate-overlay">
      <div className="access-gate-card">
        <div className="access-gate-header">
          <div className="access-gate-badge">MINERD • Planifica Maestro</div>
          <h2>🔒 Acceso Protegido</h2>
          <p>Introduce la clave institucional confidencial para acceder a la versión de prueba.</p>
        </div>

        <form onSubmit={handleSubmit} className="access-gate-form">
          <label className="access-gate-label">
            Clave Institucional
            <input
              type="password"
              className="access-gate-input"
              placeholder="Introduce la contraseña"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setErrorMsg(null); }}
              autoFocus
              disabled={verificando}
            />
          </label>

          {errorMsg && (
            <div className="access-gate-error">
              ⚠️ {errorMsg}
            </div>
          )}

          <button type="submit" className="access-gate-btn" disabled={verificando}>
            {verificando ? "Verificando..." : "Entrar a la Aplicación"}
          </button>
        </form>

        <div className="access-gate-footer">
          <span>Sistema de Planificación Curricular Dominicano • v2.0</span>
        </div>
      </div>
    </div>
  );
}
