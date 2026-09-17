import { useState, useEffect } from "react";
import { obtenerUsuarioIdActual } from "../hooks/useAuth.js";

const PERFIL_KEY = "planifica_maestro_perfil";

function cargarPerfil() {
  try {
    const saved = localStorage.getItem(PERFIL_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migración Fase 14 / Supabase: Si hay usuario autenticado, su ID prevalece
      const authId = obtenerUsuarioIdActual();
      if (authId) {
        parsed.docenteId = authId;
      } else {
        // Modo invitado: asegurar un ID anónimo independiente
        if (!parsed.anonDocenteId) {
          parsed.anonDocenteId = (parsed.docenteId && parsed.docenteId.startsWith("docente_"))
            ? parsed.docenteId
            : ("docente_" + Math.random().toString(36).substring(2, 10));
        }
        parsed.docenteId = parsed.anonDocenteId;
      }
      return parsed;
    }
  } catch (e) { /* ignore */ }

  const authId = obtenerUsuarioIdActual();
  const anonId = "docente_" + Math.random().toString(36).substring(2, 10);
  const defaultPerfil = {
    docenteId: authId || anonId,
    anonDocenteId: anonId,
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
  const authId = obtenerUsuarioIdActual();
  if (authId) {
    perfil.docenteId = authId;
  } else {
    if (!perfil.anonDocenteId) {
      perfil.anonDocenteId = (perfil.docenteId && perfil.docenteId.startsWith("docente_"))
        ? perfil.docenteId
        : ("docente_" + Math.random().toString(36).substring(2, 10));
    }
    perfil.docenteId = perfil.anonDocenteId;
  }
  localStorage.setItem(PERFIL_KEY, JSON.stringify(perfil));
}

export function obtenerDocenteId() {
  const authId = obtenerUsuarioIdActual();
  if (authId) return authId;
  return cargarPerfil().docenteId;
}

export function obtenerPerfil() {
  const perfil = cargarPerfil();
  if (!perfil.fechaManual) {
    perfil.fecha = new Date().toISOString().split("T")[0];
  }
  return perfil;
}

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
