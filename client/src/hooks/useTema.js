import { useState, useEffect } from "react";

export function useTema() {
  const [modoTema, setModoTema] = useState(() => {
    try {
      return localStorage.getItem("pm_tema") || "auto";
    } catch (e) {
      // Si localStorage no está disponible (modo privado/restricciones), fallback a auto
      return "auto";
    }
  });

  useEffect(() => {
    if (modoTema === "auto") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", modoTema);
    }
  }, [modoTema]);

  const aplicarTema = (nuevoTema) => {
    setModoTema(nuevoTema);
    try {
      localStorage.setItem("pm_tema", nuevoTema);
    } catch (e) {
      // Si localStorage no está disponible, el estado en memoria persiste en la sesión
    }
    if (nuevoTema === "auto") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", nuevoTema);
    }
  };

  return { modoTema, aplicarTema };
}

export default useTema;
