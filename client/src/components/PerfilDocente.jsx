import { useState, useEffect } from "react";

const PERFIL_KEY = "planifica_maestro_perfil";

function cargarPerfil() {
  try {
    const saved = localStorage.getItem(PERFIL_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!parsed.docenteId) {
        parsed.docenteId = "docente_" + Math.random().toString(36).substring(2, 10);
        localStorage.setItem(PERFIL_KEY, JSON.stringify(parsed));
      }
      return parsed;
    }
  } catch (e) { /* ignore */ }
  const defaultPerfil = {
    docenteId: "docente_" + Math.random().toString(36).substring(2, 10),
    nombre: "",
    escuela: "",
    fecha: new Date().toISOString().split("T")[0]
  };
  try {
    localStorage.setItem(PERFIL_KEY, JSON.stringify(defaultPerfil));
  } catch (e) {}
  return defaultPerfil;
}

function guardarPerfil(perfil) {
  localStorage.setItem(PERFIL_KEY, JSON.stringify(perfil));
}

export function obtenerDocenteId() {
  return cargarPerfil().docenteId;
}

export function obtenerPerfil() {
  const perfil = cargarPerfil();
  // Siempre actualizar la fecha a hoy si no fue editada manualmente
  if (!perfil.fechaManual) {
    perfil.fecha = new Date().toISOString().split("T")[0];
  }
  return perfil;
}

export default function PerfilDocente({ onCerrar }) {
  const [nombre, setNombre] = useState("");
  const [escuela, setEscuela] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [fechaManual, setFechaManual] = useState(false);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    const perfil = cargarPerfil();
    setNombre(perfil.nombre || "");
    setEscuela(perfil.escuela || "");
    setFecha(perfil.fecha || new Date().toISOString().split("T")[0]);
    setFechaManual(perfil.fechaManual || false);
  }, []);

  const handleGuardar = () => {
    const perfilActual = cargarPerfil();
    guardarPerfil({ ...perfilActual, nombre, escuela, fecha, fechaManual });
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
            Estos datos se guardan en tu dispositivo y se auto-rellenan en cada planificación nueva.
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
            {guardado ? "✓ Guardado" : "Guardar Perfil"}
          </button>
        </div>
      </div>
    </div>
  );
}
