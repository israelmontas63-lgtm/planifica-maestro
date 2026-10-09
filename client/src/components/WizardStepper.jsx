import React, { useRef, useEffect } from "react";

export default function WizardStepper({ 
  pasoActual, 
  onConfigurarClick, 
  onTemaClick,
  onRevisarClick,
  periodo, 
  esquemaLabel 
}) {
  const stepperRef = useRef(null);

  // Auto-scroll del contenedor interno si la pantalla es muy estrecha (≤340px)
  useEffect(() => {
    if (!stepperRef.current) return;
    const container = stepperRef.current;
    const activeEl = container.querySelector('.pm-step-item.activo');
    if (activeEl) {
      const left = activeEl.offsetLeft - (container.clientWidth - activeEl.clientWidth) / 2;
      container.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
    }
  }, [pasoActual]);

  const pasos = [
    {
      num: 1,
      titulo: "Configurar",
      tituloCorto: "Configurar",
      detalle: `${periodo || "Diaria"} • ${esquemaLabel || "Primario"}`,
      detalleCorto: periodo || "Diaria",
      clickable: true,
      onClick: onConfigurarClick,
      tooltip: "Toca para cambiar esquema curricular o periodo"
    },
    {
      num: 2,
      titulo: "Tema / Material",
      tituloCorto: "Tema",
      detalle: pasoActual >= 2 ? (pasoActual === 2 ? "Voz, Foto o Texto" : "Recibido ✓") : "Pendiente",
      detalleCorto: pasoActual >= 2 ? (pasoActual === 2 ? "Voz o Texto" : "Recibido ✓") : "Pendiente",
      clickable: true,
      onClick: onTemaClick,
      tooltip: "Toca para escribir o dictar el tema de la clase"
    },
    {
      num: 3,
      titulo: "Revisar y Exportar",
      tituloCorto: "Revisar",
      detalle: pasoActual === 3 ? "Listo para Word/Imprimir" : "Generación con IA",
      detalleCorto: pasoActual === 3 ? "Listo Word" : "Con IA",
      clickable: pasoActual === 3,
      onClick: onRevisarClick,
      tooltip: pasoActual === 3 ? "Toca para ir al plan generado y opciones de exportación" : "Disponible tras generar la planificación"
    }
  ];

  return (
    <nav 
      ref={stepperRef}
      className="pm-wizard-stepper no-print" 
      aria-label="Progreso de planificación"
    >
      <ol className="pm-stepper-list">
        {pasos.map((p) => {
          const isCompletado = pasoActual > p.num;
          const isActivo = pasoActual === p.num;
          const statusClass = isCompletado ? "completado" : isActivo ? "activo" : "pendiente";

          return (
            <li
              key={p.num}
              className={`pm-step-item ${statusClass} ${p.clickable ? "clickable" : ""}`}
              onClick={p.clickable ? p.onClick : undefined}
              title={p.tooltip}
              role={p.clickable ? "button" : "listitem"}
              tabIndex={p.clickable ? 0 : undefined}
            >
              <div className="pm-step-indicator" aria-hidden="true">
                {isCompletado ? (
                  <span className="pm-step-check">✓</span>
                ) : (
                  <span className="pm-step-num">{p.num}</span>
                )}
              </div>
              <div className="pm-step-text">
                <span className="pm-step-titulo">
                  <span className="pm-step-label-short">{p.tituloCorto}</span>
                  <span className="pm-step-label-full">{p.titulo}</span>
                  {p.clickable && <span className="pm-step-chevron"> ▾</span>}
                </span>
                <span className="pm-step-detalle">
                  <span className="pm-step-label-short">{p.detalleCorto}</span>
                  <span className="pm-step-label-full">{p.detalle}</span>
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
