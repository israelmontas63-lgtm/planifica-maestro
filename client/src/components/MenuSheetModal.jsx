import React from "react";

/**
 * Hoja Modal de Menú desplegable desde el Avatar según referencia html rr.html:
 * - Selector de Apariencia (Automática, Clara, Oscura)
 * - Interruptor de Rollback (Volver a pantalla clásica)
 * - Acceso a "Acerca de y actualización"
 * - Acceso a Mi Perfil y Ajustes
 */
export default function MenuSheetModal({
  isOpen,
  onClose,
  modoTema,
  onCambiarTema,
  onAbrirAcerca,
  vistaNueva,
  onToggleVista,
  onAbrirPerfil,
  onAbrirConfiguracion
}) {
  if (!isOpen) return null;

  return (
    <div className="pm-sheet-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="pm-sheet-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pm-sheet-header">
          <h3>Menú</h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "1.2rem",
              fontWeight: "bold",
              cursor: "pointer",
              color: "var(--pm-mut)"
            }}
            aria-label="Cerrar menú"
          >
            ✕
          </button>
        </div>

        {/* 1. Selector de Apariencia (html rr.html) */}
        <div className="pm-sheet-row">
          <span>Apariencia</span>
          <select
            id="tm"
            className="pm-sheet-select"
            value={modoTema}
            onChange={(e) => onCambiarTema(e.target.value)}
            aria-label="Seleccionar tema visual"
          >
            <option value="auto">Automática</option>
            <option value="light">Clara</option>
            <option value="dark">Oscura</option>
          </select>
        </div>

        {/* 2. Interruptor de Rollback a la pantalla anterior - Oculto en producción hasta Fase 2 */}
        {import.meta.env.DEV && onToggleVista && (
          <button
            type="button"
            className="pm-sheet-row"
            onClick={() => {
              onToggleVista();
              onClose();
            }}
          >
            <span>Interfaz de inicio</span>
            <span style={{ fontWeight: "700", color: "var(--pm-pri)" }}>
              {vistaNueva ? "Cambiar a Clásica" : "Cambiar a Nueva"}
            </span>
          </button>
        )}

        {/* 3. Acerca de y actualización */}
        <button
          type="button"
          className="pm-sheet-row"
          id="mAcerca"
          onClick={() => {
            onClose();
            onAbrirAcerca();
          }}
        >
          <span>Acerca de y actualización</span>
          <span style={{ color: "var(--pm-mut)" }}>→</span>
        </button>

        {/* 4. Perfil y Ajustes */}
        {onAbrirPerfil && (
          <button
            type="button"
            className="pm-sheet-row"
            onClick={() => {
              onClose();
              onAbrirPerfil();
            }}
          >
            <span>Mi perfil docente</span>
            <span style={{ color: "var(--pm-mut)" }}>→</span>
          </button>
        )}

        {onAbrirConfiguracion && (
          <button
            type="button"
            className="pm-sheet-row"
            onClick={() => {
              onClose();
              onAbrirConfiguracion();
            }}
          >
            <span>Configuración y sincronización</span>
            <span style={{ color: "var(--pm-mut)" }}>→</span>
          </button>
        )}
      </div>
    </div>
  );
}
