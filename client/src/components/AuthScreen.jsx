import { useState } from "react";

export default function AuthScreen({ onSignIn, onSignUp, onResetPassword, onCerrar, isConfigured }) {
  const [mode, setMode] = useState("login"); // 'login' | 'register' | 'reset'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [escuela, setEscuela] = useState("");
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email || !email.trim()) {
      setErrorMsg("Por favor introduce tu correo electrónico.");
      return;
    }

    if (mode !== "reset" && (!password || password.length < 6)) {
      setErrorMsg("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (mode === "register" && (!nombre || !nombre.trim())) {
      setErrorMsg("Por favor introduce tu nombre completo de docente.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "login") {
        await onSignIn({ email, password });
        onCerrar?.();
      } else if (mode === "register") {
        const res = await onSignUp({ email, password, nombre, escuela });
        // Si la sesión se inició de inmediato
        if (res?.session) {
          onCerrar?.();
        } else if (res?.user) {
          // Si requiere confirmación de correo
          setSuccessMsg(
            `¡Cuenta creada exitosamente! Revisa tu bandeja de entrada en ${email} para confirmar tu correo antes de iniciar sesión.`
          );
          setMode("login");
        }
      } else if (mode === "reset") {
        await onResetPassword(email);
        setSuccessMsg(`Te hemos enviado un enlace a ${email} para restablecer tu contraseña.`);
        setMode("login");
      }
    } catch (err) {
      console.error("Error de autenticación:", err);
      let msg = err.message || "Error al procesar la solicitud.";
      if (msg.includes("Invalid login credentials")) {
        msg = "Correo o contraseña incorrectos. Verifica tus datos.";
      } else if (msg.includes("User already registered")) {
        msg = "Este correo ya tiene una cuenta registrada. Intenta iniciar sesión.";
      } else if (msg.includes("Email not confirmed")) {
        msg = "Debes confirmar tu correo electrónico antes de entrar.";
      }
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pm-auth-overlay" onClick={onCerrar}>
      <div className="pm-auth-card" onClick={(e) => e.stopPropagation()}>
        {onCerrar && (
          <button
            type="button"
            className="pm-auth-close-btn"
            onClick={onCerrar}
            title="Continuar explorando como invitado"
            aria-label="Cerrar modal de autenticación"
          >
            ✕
          </button>
        )}
        {/* Encabezado con Logo y Marca */}
        <div className="pm-auth-header">
          <div className="pm-auth-logo-badge">
            <span className="pm-auth-logo-icon">📈</span>
            <span className="pm-auth-logo-title">
              Planifica <span className="pm-auth-accent">Maestro</span>
            </span>
          </div>
          <p className="pm-auth-subtitle">
            Sistema Inteligente de Planificación Curricular Dominicana (MINERD)
          </p>

          {!isConfigured && (
            <div className="pm-auth-dev-badge" title="Para conectar a la nube real de Supabase, agrega VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en client/.env">
              ⚡ Modo Prueba Directa (Supabase listo para conectar claves)
            </div>
          )}
        </div>

        {/* Selector de Pestañas (Login / Registro) */}
        {mode !== "reset" && (
          <div className="pm-auth-tabs">
            <button
              type="button"
              className={`pm-auth-tab ${mode === "login" ? "active" : ""}`}
              onClick={() => { setMode("login"); setErrorMsg(null); setSuccessMsg(null); }}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              className={`pm-auth-tab ${mode === "register" ? "active" : ""}`}
              onClick={() => { setMode("register"); setErrorMsg(null); setSuccessMsg(null); }}
            >
              Crear Cuenta
            </button>
          </div>
        )}

        {/* Título de Vista Reset */}
        {mode === "reset" && (
          <div className="pm-auth-reset-heading">
            <h3>Recuperar Contraseña</h3>
            <p>Ingresa tu correo para recibir un enlace seguro de restablecimiento.</p>
          </div>
        )}

        {/* Alertas de Error o Éxito */}
        {errorMsg && (
          <div className="pm-auth-alert pm-auth-error" role="alert">
            <span>⚠️</span>
            <div>{errorMsg}</div>
          </div>
        )}

        {successMsg && (
          <div className="pm-auth-alert pm-auth-success" role="alert">
            <span>✓</span>
            <div>{successMsg}</div>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="pm-auth-form">
          {mode === "register" && (
            <>
              <div className="pm-auth-field">
                <label>Nombre y Apellido</label>
                <input
                  type="text"
                  placeholder="Ej: Lic. María Rosario"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div className="pm-auth-field">
                <label>Centro Educativo / Escuela (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: Escuela Primaria República de Colombia"
                  value={escuela}
                  onChange={(e) => setEscuela(e.target.value)}
                  disabled={loading}
                />
              </div>
            </>
          )}

          <div className="pm-auth-field">
            <label>Correo Electrónico</label>
            <input
              type="email"
              placeholder="docente@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="email"
              required
            />
          </div>

          {mode !== "reset" && (
            <div className="pm-auth-field">
              <div className="pm-auth-field-header">
                <label>Contraseña</label>
                {mode === "login" && (
                  <button
                    type="button"
                    className="pm-auth-forgot-btn"
                    onClick={() => { setMode("reset"); setErrorMsg(null); setSuccessMsg(null); }}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                )}
              </div>
              <input
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
              />
            </div>
          )}

          <button
            type="submit"
            className="pm-auth-submit-btn"
            disabled={loading}
          >
            {loading ? (
              <span>Procesando...</span>
            ) : mode === "login" ? (
              "Ingresar a Planifica Maestro"
            ) : mode === "register" ? (
              "Registrar Mi Cuenta de Maestro"
            ) : (
              "Enviar Enlace de Recuperación"
            )}
          </button>
        </form>

        {/* Pie de Pantalla */}
        <div className="pm-auth-footer">
          {mode === "reset" ? (
            <button
              type="button"
              className="pm-auth-back-btn"
              onClick={() => { setMode("login"); setErrorMsg(null); setSuccessMsg(null); }}
            >
              ← Volver al inicio de sesión
            </button>
          ) : (
            <p>
              {mode === "login" ? "¿Aún no tienes cuenta? " : "¿Ya tienes una cuenta registrada? "}
              <button
                type="button"
                className="pm-auth-toggle-link"
                onClick={() => {
                  setMode(mode === "login" ? "register" : "login");
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
              >
                {mode === "login" ? "Regístrate gratis aquí" : "Inicia sesión"}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
