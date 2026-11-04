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

export default function HomeGreeting({ user, onSeleccionarSugerencia, onEnviarConsulta }) {
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
    const texto = inputValue.trim();
    if (!texto) return;
    if (onEnviarConsulta) {
      onEnviarConsulta(texto);
    } else if (onSeleccionarSugerencia) {
      onSeleccionarSugerencia(texto);
    }
    setInputValue("");
  };

  return (
    <div 
      style={{
        width: '100%',
        maxWidth: '380px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: '12px 10px 16px 10px',
        boxSizing: 'border-box'
      }}
      aria-live="polite"
    >
      {/* 1. Saludo superior */}
      <div style={{ marginBottom: '14px' }}>
        <div 
          style={{
            backgroundColor: '#fef3c7',
            border: '1px solid #fde68a',
            color: '#78350f',
            fontWeight: 600,
            fontSize: '12px',
            padding: '5px 14px',
            borderRadius: '9999px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span aria-hidden="true">☀️</span>
          <span>{saludo}</span>
        </div>
      </div>

      {/* 2. Pregunta central */}
      <h1 
        style={{
          color: '#0f172a',
          fontWeight: 800,
          fontSize: '22px',
          letterSpacing: '-0.025em',
          lineHeight: '1.25',
          margin: '0 0 16px 0'
        }}
      >
        ¿Qué vamos a hacer, maestro?
      </h1>

      {/* 3. Cápsula de búsqueda unificada */}
      <form onSubmit={handleSubmit} style={{ width: '100%', marginBottom: '20px' }}>
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#ffffff',
            border: '1.5px solid #cbd5e1',
            borderRadius: '9999px',
            padding: '4px 6px 4px 14px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            boxSizing: 'border-box',
            width: '100%'
          }}
        >
          <span style={{ fontSize: '18px', marginRight: '8px', userSelect: 'none' }} aria-hidden="true">✍️</span>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Pregunta, pide una idea o escribe un tema..."
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: '#0f172a',
              fontSize: '14px',
              fontWeight: 500,
              minWidth: 0
            }}
            aria-label="Consulta o tema curricular"
          />
          <button
            type="submit"
            aria-label="Enviar"
            title="Enviar mensaje o consulta"
            style={{
              backgroundColor: '#1a5b6c',
              color: '#ffffff',
              border: 'none',
              borderRadius: '9999px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              transition: 'all 0.15s ease'
            }}
          >
            <span>Enviar</span>
            <span style={{ fontSize: '14px', lineHeight: 1 }} aria-hidden="true">↑</span>
          </button>
        </div>
      </form>

      {/* 4. Sugerencias curriculares */}
      {onSeleccionarSugerencia && (
        <div style={{ width: '100%' }}>
          <div 
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '10px'
            }}
          >
            💡 Ideas curriculares para empezar hoy:
          </div>
          <div 
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {SUGERENCIAS_CURRICULARES.map((sug, idx) => (
              <button
                key={idx}
                type="button"
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  color: '#334155',
                  fontWeight: 600,
                  fontSize: '12px',
                  padding: '7px 12px',
                  borderRadius: '9999px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                }}
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

