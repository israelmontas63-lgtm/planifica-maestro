import { useState } from "react";
import { verificarLlaveMaestra } from "../services/api.js";

export default function OwnerModal({ onCerrar, onSuccess }) {
  const [key, setKey] = useState("");
  const [cargando, setCargando] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!key || !key.trim()) {
      setErrorMsg("Introduce la llave maestra.");
      return;
    }

    setErrorMsg(null);
    setCargando(true);

    try {
      await verificarLlaveMaestra(key.trim());
      localStorage.setItem("pm_owner_key", key.trim());
      onSuccess?.(key.trim());
      onCerrar?.();
    } catch (err) {
      setErrorMsg(err.message || "Llave maestra incorrecta.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="pm-auth-overlay" onClick={onCerrar} style={{ zIndex: 1100 }}>
      <div 
        className="pm-auth-card" 
        onClick={(e) => e.stopPropagation()} 
        style={{ maxWidth: "380px", border: "1.5px solid #d97706", boxShadow: "0 20px 50px rgba(217, 119, 6, 0.25)" }}
      >
        <button
          type="button"
          className="pm-auth-close-btn"
          onClick={onCerrar}
          title="Cerrar"
          aria-label="Cerrar modal de propietario"
        >
          ✕
        </button>

        <div className="pm-auth-header" style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "32px", marginBottom: "6px" }}>👑</div>
          <h2 style={{ margin: 0, fontSize: "20px", color: "#12304a", fontWeight: "800" }}>
            Acceso de Propietario
          </h2>
          <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#64748b" }}>
            Introduce tu Llave Maestra para activar el modo creador con privilegios totales y cuota ilimitada.
          </p>
        </div>

        {errorMsg && (
          <div className="pm-auth-alert pm-auth-error" style={{ marginBottom: "12px" }}>
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
              Llave Maestra (OWNER_MASTER_KEY):
            </label>
            <input
              type="password"
              className="pm-auth-input"
              placeholder="••••••••••••••••"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              autoFocus
              style={{
                width: "100%",
                padding: "11px 14px",
                borderRadius: "10px",
                border: "1.5px solid #cbd5e1",
                fontSize: "14px",
                outline: "none",
                boxSizing: "border-box"
              }}
            />
          </div>

          <button
            type="submit"
            disabled={cargando}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #d97706 0%, #b45309 100%)",
              color: "#ffffff",
              fontWeight: "700",
              fontSize: "14px",
              border: "none",
              cursor: cargando ? "not-allowed" : "pointer",
              boxShadow: "0 4px 12px rgba(217, 119, 6, 0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px"
            }}
          >
            {cargando ? (
              <span>Verificando en servidor...</span>
            ) : (
              <span>👑 Desbloquear Modo Propietario</span>
            )}
          </button>
        </form>

        <div style={{ marginTop: "14px", textAlign: "center" }}>
          <button
            type="button"
            onClick={onCerrar}
            style={{ background: "none", border: "none", color: "#64748b", fontSize: "12px", cursor: "pointer", textDecoration: "underline" }}
          >
            Continuar en modo normal
          </button>
        </div>
      </div>
    </div>
  );
}
