import { useState, useEffect, useMemo } from "react";

const PHRASES = [
  "¿Qué vamos a hacer hoy?",
  "¿Qué nos toca hoy?",
  "¿En qué te ayudo?"
];

export default function HomeGreeting({ user }) {
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

    const nombreCompleto =
      user?.user_metadata?.nombre ||
      user?.user_metadata?.full_name ||
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
    </div>
  );
}
