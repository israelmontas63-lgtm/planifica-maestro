import { useState, useEffect } from "react";
import { cargarPerfil, guardarPerfil, obtenerDocenteId, obtenerPerfil } from "../services/perfilStorage.js";
export { cargarPerfil, guardarPerfil, obtenerDocenteId, obtenerPerfil };

export default function PerfilDocente({ user, onActualizarPerfil, onCerrar }) {
  const [nombre, setNombre] = useState("");
  const [escuela, setEscuela] = useState("");
  const [tanda, setTanda] = useState("Jornada Escolar Extendida (JEE)");
  const [seccion, setSeccion] = useState("A");
  const [grado, setGrado] = useState("");
  const [regional, setRegional] = useState("");
  const [distrito, setDistrito] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [fechaManual, setFechaManual] = useState(false);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    const perfil = cargarPerfil() || {};
    // Priorizar datos de user_metadata de Supabase si existen
    const userNombre = user?.user_metadata?.nombre || user?.user_metadata?.full_name || perfil?.nombre || "";
    const userEscuela = user?.user_metadata?.escuela || perfil?.escuela || "";

    setNombre(userNombre);
    setEscuela(userEscuela);
    setTanda(perfil?.tanda || "Jornada Escolar Extendida (JEE)");
    setSeccion(perfil?.seccion || "A");
    setGrado(perfil?.grado || "");
    setRegional(perfil?.regional || "");
    setDistrito(perfil?.distrito || "");
    setFecha(perfil?.fecha || new Date().toISOString().split("T")[0]);
    setFechaManual(Boolean(perfil?.fechaManual));
  }, [user]);

  const handleGuardar = async () => {
    const perfilActual = cargarPerfil() || {};
    const perfilActualizado = {
      ...perfilActual,
      nombre,
      escuela,
      tanda,
      seccion,
      grado,
      regional,
      distrito,
      fecha,
      fechaManual
    };
    guardarPerfil(perfilActualizado);

    // FASE 17 - Punto 2: Fusión de perfil en user_metadata de Supabase
    if (onActualizarPerfil) {
      try {
        await onActualizarPerfil({
          nombre,
          escuela,
          tanda,
          seccion,
          grado,
          regional,
          distrito
        });
      } catch (err) {
        console.warn("Aviso actualizando metadata en Supabase:", err);
      }
    }

    setGuardado(true);
    setTimeout(() => {
      setGuardado(false);
      onCerrar();
    }, 1200);
  };

  return (
    <div className="schema-overlay" onClick={onCerrar}>
      <div className="schema-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "520px" }}>
        
        <div className="schema-header">
          <h2>Perfil del Docente</h2>
          <button className="schema-close-btn" onClick={onCerrar}>✕</button>
        </div>

        <div className="perfil-body">
          <p className="perfil-intro">
            Tus datos se sincronizan con tu cuenta y se auto-rellenan en la matriz oficial de cada planificación nueva.
          </p>

          <label className="perfil-label">
            Nombre del Docente
            <input
              type="text"
              className="perfil-input"
              placeholder="Ej: Prof. María Pérez"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </label>

          <label className="perfil-label">
            Escuela / Centro Educativo
            <input
              type="text"
              className="perfil-input"
              placeholder="Ej: Escuela Básica Juan Pablo Duarte"
              value={escuela}
              onChange={(e) => setEscuela(e.target.value)}
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <label className="perfil-label">
              Tanda / Jornada
              <select
                className="perfil-input"
                value={tanda}
                onChange={(e) => setTanda(e.target.value)}
                style={{ cursor: "pointer" }}
              >
                <option value="Jornada Escolar Extendida (JEE)">Jornada Escolar Extendida (JEE)</option>
                <option value="Matutina">Matutina</option>
                <option value="Vespertina">Vespertina</option>
                <option value="Nocturna">Nocturna</option>
              </select>
            </label>

            <label className="perfil-label">
              Sección
              <input
                type="text"
                className="perfil-input"
                placeholder="Ej: A, B, C o Única"
                value={seccion}
                onChange={(e) => setSeccion(e.target.value)}
              />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <label className="perfil-label">
              Regional Educativa (Opcional)
              <input
                type="text"
                className="perfil-input"
                placeholder="Ej: 10 - Santo Domingo"
                value={regional}
                onChange={(e) => setRegional(e.target.value)}
              />
            </label>

            <label className="perfil-label">
              Distrito Educativo (Opcional)
              <input
                type="text"
                className="perfil-input"
                placeholder="Ej: 10-01"
                value={distrito}
                onChange={(e) => setDistrito(e.target.value)}
              />
            </label>
          </div>

          <label className="perfil-label">
            Grado Habitual (Opcional)
            <input
              type="text"
              className="perfil-input"
              placeholder="Ej: 3ro de Primaria"
              value={grado}
              onChange={(e) => setGrado(e.target.value)}
            />
          </label>

          <label className="perfil-label">
            Fecha (se autocompleta con la fecha de hoy)
            <input
              type="date"
              className="perfil-input"
              value={fecha}
              onChange={(e) => { setFecha(e.target.value); setFechaManual(true); }}
            />
            {fechaManual && (
              <button 
                className="perfil-reset-fecha"
                onClick={() => { setFecha(new Date().toISOString().split("T")[0]); setFechaManual(false); }}
              >
                ↺ Usar fecha de hoy
              </button>
            )}
          </label>

          <button className="perfil-guardar" onClick={handleGuardar}>
            {guardado ? "✓ Guardado y Sincronizado" : "Guardar Perfil"}
          </button>

          <div style={{ textAlign: "center", marginTop: "14px", fontSize: "11px", color: "#64748b", fontWeight: "500" }}>
            Planifica Maestro PWA — Versión: <span style={{ fontFamily: "monospace", fontWeight: "700", color: "#0f766e" }}>{typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "1.0.0"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
