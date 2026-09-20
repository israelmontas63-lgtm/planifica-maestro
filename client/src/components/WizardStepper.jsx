export default function WizardStepper({ 
  pasoActual, 
  onConfigurarClick, 
  onTemaClick,
  onRevisarClick,
  periodo, 
  esquemaLabel 
}) {
  const pasos = [
    {
      num: 1,
      titulo: "Configurar",
      detalle: `${periodo || "Diaria"} • ${esquemaLabel || "Primario"}`,
      clickable: true,
      onClick: onConfigurarClick,
      tooltip: "Toca para cambiar esquema curricular o periodo"
    },
    {
      num: 2,
      titulo: "Tema / Material",
      detalle: pasoActual >= 2 ? (pasoActual === 2 ? "Voz, Foto o Texto" : "Recibido ✓") : "Pendiente",
      clickable: true,
      onClick: onTemaClick,
      tooltip: "Toca para escribir o dictar el tema de la clase"
    },
    {
      num: 3,
      titulo: "Revisar y Exportar",
      detalle: pasoActual === 3 ? "Listo para Word/Imprimir" : "Generación con IA",
      clickable: pasoActual === 3,
      onClick: onRevisarClick,
      tooltip: pasoActual === 3 ? "Toca para ir al plan generado y opciones de exportación" : "Disponible tras generar la planificación"
    }
  ];

  return (
    <nav className="pm-wizard-stepper no-print" aria-label="Progreso de planificación">
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
              <div className="pm-step-indicator">
                {isCompletado ? (
                  <span className="pm-step-check">✓</span>
                ) : (
                  <span className="pm-step-num">{p.num}</span>
                )}
              </div>
              <div className="pm-step-text">
                <span className="pm-step-titulo">
                  {p.titulo}
                  {p.clickable && <span className="pm-step-chevron"> ▾</span>}
                </span>
                <span className="pm-step-detalle">{p.detalle}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
