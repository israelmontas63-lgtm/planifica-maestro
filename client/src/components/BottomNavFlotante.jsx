import React, { useState, useEffect } from "react";

/**
 * Barra inferior flotante de 3 botones según guía de referencia html rr.html:
 * 1. Foto (abre cámara de materiales)
 * 2. Dictar (botón central circular destacado, resiliente a pausas)
 * 3. Historial (abre planificaciones guardadas)
 * Más línea inferior interactiva de versión y comprobación de actualizaciones.
 */
export default function BottomNavFlotante({
  onFoto,
  onDictar,
  listening,
  duracionTexto,
  onHistorial,
  onAcerca
}) {
  const [versionCommit, setVersionCommit] = useState(null);

  useEffect(() => {
    let cancelado = false;
    fetch("/version.json", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelado) {
          if (data && data.commit) {
            setVersionCommit(data.commit);
          } else {
            setVersionCommit(null);
          }
        }
      })
      .catch(() => {
        if (!cancelado) setVersionCommit(null);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <nav className="pm-nav-flotante" aria-label="Navegación principal">
      <div className="pm-nav-flotante-inner">
        {/* 1. Botón Foto */}
        <button
          type="button"
          id="nFoto"
          className="pm-nav-btn"
          onClick={onFoto}
          aria-label="Tomar foto de materiales"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
          <span>Foto</span>
        </button>

        {/* 2. Botón Dictar (Central Destacado) */}
        <button
          type="button"
          id="nMic"
          className={`pm-nav-btn pm-nav-mic ${listening ? "recording" : ""}`}
          onClick={onDictar}
          aria-label={listening ? `Detener dictado (${duracionTexto || "grabando"})` : "Dictar tema por voz"}
        >
          <div className="pm-nav-mic-circle">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="9" y="3" width="6" height="12" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          </div>
          <span>{listening ? `Dictando (${duracionTexto || "0:00"})` : "Dictar"}</span>
        </button>

        {/* 3. Botón Historial */}
        <button
          type="button"
          id="nHist"
          className="pm-nav-btn"
          onClick={onHistorial}
          aria-label="Ver historial de planificaciones"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          <span>Historial</span>
        </button>
      </div>

      {/* Línea de versión interactiva */}
      <button
        type="button"
        id="ver"
        className="pm-nav-version"
        onClick={onAcerca}
        title="Ver detalles de la versión y buscar actualizaciones"
      >
        {versionCommit ? `Versión ${versionCommit} · toca para buscar actualización` : "Versión no disponible"}
      </button>
    </nav>
  );
}
