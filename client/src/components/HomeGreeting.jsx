// Ruta: client/src/components/HomeGreeting.jsx
import { useState, useMemo } from "react";
import { cargarPerfil } from "../services/perfilStorage.js";

const SUGERENCIAS_CURRICULARES = [
  {
    icono: "🔢",
    texto: "Fracciones para 3.º",
    prompt: "Planificar una clase de Matemática sobre fracciones con material concreto para 3.º de Primaria."
  },
  {
    icono: "📖",
    texto: "La anécdota (4.º)",
    prompt: "Planificar una clase de Lengua Española sobre la anécdota y comprensión lectora para 4.º de Primaria."
  },
  {
    icono: "🌱",
    texto: "Ecosistemas (5.º)",
    prompt: "Planificar una sesión de Ciencias de la Naturaleza sobre ecosistemas y biodiversidad dominicana para 5.º de Primaria."
  },
  {
    icono: "🇩🇴",
    texto: "Símbolos patrios (2.º)",
    prompt: "Planificar una clase de Ciencias Sociales sobre los símbolos patrios y Juan Pablo Duarte para 2.º de Primaria."
  },
  {
    icono: "📚",
    texto: "Secuencia Con Base",
    prompt: "Estructurar una secuencia didáctica del programa Con Base para primer ciclo de Primaria enfocada en alfabetización inicial."
  }
];

export default function HomeGreeting({ user, onSeleccionarSugerencia }) {
  const [inputValue, setInputValue] = useState("");

  const saludo = useMemo(() => {
    let hour = new Date().getHours();
    try {
      const parts = new Intl.DateTimeFormat("es-DO", {
        timeZone: "America/Santo_Domingo",
        hour: "numeric",
        hour12: false
      }).formatToParts(new Date());
      const h = parts.find((p) => p.type === "hour");
      if (h) hour = parseInt(h.value, 10);
    } catch (e) {}

    const perfilLocal = (!user) ? (cargarPerfil() || {}) : {};
    const nombreCompleto =
      user?.user_metadata?.nombre ||
      user?.user_metadata?.full_name ||
      perfilLocal.nombre ||
      "";
    const primerNombre = nombreCompleto.trim().split(" ")[0];
    const sufijo = primerNombre ? `profe ${primerNombre}` : "profe";

    if (hour >= 5 && hour < 12) {
      return `Buenos días, ${sufijo}`;
    } else if (hour >= 12 && hour < 19) {
      return `Buenas tardes, ${sufijo}`;
    } else {
      return `Buenas noches, ${sufijo}`;
    }
  }, [user]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (onSeleccionarSugerencia && inputValue.trim()) {
      onSeleccionarSugerencia(inputValue.trim());
      setInputValue("");
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col items-center justify-center text-center px-4 py-6 bg-transparent" aria-live="polite">
      {/* 1. Saludo superior */}
      <div className="flex justify-center mb-3">
        <div className="bg-amber-50 border border-amber-200 text-amber-900 font-semibold text-xs px-3.5 py-1 rounded-full shadow-xs inline-flex items-center gap-1.5">
          <span aria-hidden="true">☀️</span>
          <span>{saludo}</span>
        </div>
      </div>

      {/* 2. Pregunta central de máximo contraste sobre fondo blanco */}
      <h1 className="text-slate-900 font-extrabold text-2xl sm:text-3xl tracking-tight text-center mb-5 leading-tight">
        ¿Qué vamos a hacer, maestro?
      </h1>

      {/* 3. Input interactivo con botón en azul petróleo */}
      <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto mb-6">
        <div className="relative flex items-center bg-white border border-slate-300 rounded-2xl shadow-xs hover:border-slate-400 focus-within:border-[#1a5b6c] focus-within:ring-2 focus-within:ring-[#1a5b6c]/10 transition-all px-4 py-2.5">
          <span className="text-slate-400 text-base mr-2.5 select-none" aria-hidden="true">✍️</span>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="¿Qué vamos a hacer, maestro?"
            className="w-full bg-transparent focus:outline-none placeholder-slate-400 text-slate-900 font-medium text-sm sm:text-base"
            aria-label="Consulta o tema curricular"
          />
          <button
            type="submit"
            className="ml-2 inline-flex items-center justify-center bg-[#1a5b6c] text-white rounded-xl px-3.5 py-1.5 text-xs font-semibold hover:bg-[#154957] active:scale-95 transition-all shadow-xs shrink-0 cursor-pointer"
            title="Iniciar planificación"
          >
            <span>Planificar</span>
          </button>
        </div>
      </form>

      {/* 4. Sugerencias curriculares */}
      {onSeleccionarSugerencia && (
        <div className="w-full max-w-lg mx-auto">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3 text-center">
            💡 Ideas curriculares para empezar hoy:
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {SUGERENCIAS_CURRICULARES.map((sug, idx) => (
              <button
                key={idx}
                type="button"
                className="bg-white border border-slate-200 text-slate-800 shadow-2xs hover:border-slate-300 hover:bg-slate-50 font-medium text-xs px-3.5 py-1.5 rounded-full inline-flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                onClick={() => onSeleccionarSugerencia(sug.prompt)}
                title={`Crear: ${sug.prompt}`}
              >
                <span>{sug.icono}</span>
                <span>{sug.texto}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

