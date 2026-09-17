import { useState, useEffect } from "react";
import { cargarPerfil, guardarPerfil, obtenerDocenteId, obtenerPerfil } from "../services/perfilStorage.js";
export { cargarPerfil, guardarPerfil, obtenerDocenteId, obtenerPerfil };

export default function PerfilDocente({ user, onActualizarPerfil, onCerrar }) {
  const [nombre, setNombre] = useState("");
  const [escuela, setEscuela] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [fechaManual, setFechaManual] = useState(false);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    const perfil = cargarPerfil();
    // Priorizar datos de user_metadata de Supabase si existen
    const userNombre = user?.user_metadata?.nombre || user?.user_metadata?.full_name || perfil.nombre || "";
    const userEscuela = user?.user_metadata?.escuela || perfil.escuela || "";

    setNombre(userNombre);
    setEscuela(userEscuela);
    setFecha(perfil.fecha || new Date().toISOString().split("T")[0]);
    setFechaManual(perfil.fechaManual || false);
  }, [user]);

  const handleGuardar = async () => {
    const perfilActual = cargarPerfil();
    guardarPerfil({ ...perfilActual, nombre, escuela, fecha, fechaManual });

    // FASE 17 - Punto 2: Fusión de perfil en user_metadata de Supabase
    if (onActualizarPerfil) {
      try {
        await onActualizarPerfil({ nombre, escuela });
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
      <div className="schema-panel" onClick={(e) => e.stopPropagation()}>
        
        <div className="schema-header">
          <h2>Perfil del Docente</h2>
          <button className="schema-close-btn" onClick={onCerrar}>✕</button>
        </div>

        <div className="perfil-body">
          <p className="perfil-intro">
            Tus datos se sincronizan con tu cuenta de Planifica Maestro y se auto-rellenan en cada planificación nueva.
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
            Escuela / Institución
            <input
              type="text"
              className="perfil-input"
              placeholder="Ej: Escuela Básica Juan Pablo Duarte"
              value={escuela}
              onChange={(e) => setEscuela(e.target.value)}
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
        </div>
      </div>
    </div>
  );
}
