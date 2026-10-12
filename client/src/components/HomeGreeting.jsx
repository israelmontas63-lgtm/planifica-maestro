import { useState, useEffect, useMemo } from "react";
import { cargarPerfil } from "../services/perfilStorage.js";

const PHRASES = [
  "¿Qué vamos a hacer hoy?",
  "¿Qué nos toca hoy?",
  "¿En qué te ayudo?"
];

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
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // 1. Saludo contextual según la hora del día en República Dominicana
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

  // 2. Detección de preferencia de movimiento reducido
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // 3. Efecto máquina de escribir (Typewriter) o rotación estática para movimiento reducido
  useEffect(() => {
    const currentTarget = PHRASES[phraseIndex];

    if (prefersReducedMotion) {
      setDisplayText(currentTarget);
      const timer = setTimeout(() => {
        setPhraseIndex((prev) => (prev + 1) % PHRASES.length);
      }, 4000);
      return () => clearTimeout(timer);
    }

    let timeout;
    if (!isDeleting) {
      // Escribiendo
      if (displayText.length < currentTarget.length) {
        timeout = setTimeout(() => {
          setDisplayText(currentTarget.slice(0, displayText.length + 1));
        }, 65);
      } else {
        // Pausa cuando se completa la frase
        timeout = setTimeout(() => {
          setIsDeleting(true);
        }, 2200);
      }
    } else {
      // Borrando
      if (displayText.length > 0) {
        timeout = setTimeout(() => {
          setDisplayText(currentTarget.slice(0, displayText.length - 1));
        }, 35);
      } else {
        // Pasar a la siguiente frase
        setIsDeleting(false);
        setPhraseIndex((prev) => (prev + 1) % PHRASES.length);
        timeout = setTimeout(() => {}, 350);
      }
    }

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, phraseIndex, prefersReducedMotion]);

  return (
    <div className="pm-home-greeting-container" aria-live="polite">
      <div className="pm-greeting-badge">
        <span className="pm-greeting-sun" aria-hidden="true">☀️</span>
        <span className="pm-greeting-time-text">{saludo}</span>
      </div>

      <h1 className="pm-greeting-typewriter-title">
        <span className="pm-greeting-serif-text">{displayText}</span>
        <span className="pm-typewriter-cursor" aria-hidden="true">|</span>
      </h1>

      {onSeleccionarSugerencia && (
        <div className="pm-home-suggestions-container" style={{ marginTop: "14px", animation: "fadeIn 0.3s ease" }}>
          <div style={{ fontSize: "11.5px", fontWeight: "600", color: "#64748b", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            💡 Ideas curriculares para empezar hoy:
          </div>
          <div className="pm-quick-replies-row" style={{ justifyContent: "center" }}>
            {SUGERENCIAS_CURRICULARES.map((sug, idx) => (
              <button
                key={idx}
                type="button"
                className="pm-quick-reply-pill"
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
