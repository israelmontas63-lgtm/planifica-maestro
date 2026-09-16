import { useState, useMemo } from "react";
import {
  obtenerTodasLasPlanificaciones,
  duplicarPlanEnBiblioteca,
  eliminarPlanDeBiblioteca
} from "../services/bibliotecaStorage.js";

export default function MisPlanificaciones({
  onCerrar,
  onAbrirPlan,
  onExportarWord,
  onEscuchar
}) {
  const [planes, setPlanes] = useState(() => obtenerTodasLasPlanificaciones());
  const [filtroArea, setFiltroArea] = useState("todas");
  const [filtroGrado, setFiltroGrado] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [planSeleccionado, setPlanSeleccionado] = useState(null);

  // Extraer áreas y grados únicos para los selectores de filtro
  const areasDisponibles = useMemo(() => {
    const set = new Set();
    planes.forEach((p) => {
      if (p.area) set.add(p.area);
    });
    return ["todas", ...Array.from(set)];
  }, [planes]);

  const gradosDisponibles = useMemo(() => {
    const set = new Set();
    planes.forEach((p) => {
      if (p.grado) set.add(p.grado);
    });
    return ["todos", ...Array.from(set)];
  }, [planes]);

  // Filtrado reactivo
  const planesFiltrados = useMemo(() => {
    return planes.filter((p) => {
      const matchArea = filtroArea === "todas" || p.area === filtroArea;
      const matchGrado = filtroGrado === "todos" || p.grado === filtroGrado;
      const matchBusqueda =
        !busqueda.trim() ||
        p.titulo?.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.area?.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.grado?.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.esquemaLabel?.toLowerCase().includes(busqueda.toLowerCase());
      return matchArea && matchGrado && matchBusqueda;
    });
  }, [planes, filtroArea, filtroGrado, busqueda]);

  // Acciones
  function handleDuplicar(id, e) {
    if (e) e.stopPropagation();
    const copia = duplicarPlanEnBiblioteca(id);
    if (copia) {
      setPlanes(obtenerTodasLasPlanificaciones());
    }
  }

  function handleEliminar(id, e) {
    if (e) e.stopPropagation();
    if (window.confirm("¿Seguro que deseas eliminar esta planificación de tu biblioteca?")) {
      eliminarPlanDeBiblioteca(id);
      setPlanes(obtenerTodasLasPlanificaciones());
      if (planSeleccionado?.id === id) {
        setPlanSeleccionado(null);
      }
    }
  }

  function handleCargarEnApp(plan) {
    if (onAbrirPlan) {
      onAbrirPlan(plan);
    }
    onCerrar();
  }

  return (
    <div className="schema-overlay" onClick={onCerrar}>
      <div className="schema-panel biblio-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="schema-header">
          <div className="biblio-header-info">
            <span className="biblio-icon">📁</span>
            <div>
              <h2>Mis Planificaciones</h2>
              <small>{planes.length} planificaciones guardadas</small>
            </div>
          </div>
          <button className="schema-close-btn" onClick={onCerrar}>✕</button>
        </div>

        {/* Barra de Filtros */}
        <div className="biblio-filtros">
          <input
            type="text"
            className="biblio-search"
            placeholder="🔍 Buscar por tema, área, grado..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />

          <div className="biblio-selects-row">
            <div className="biblio-filtro-item">
              <label>Área:</label>
              <select
                value={filtroArea}
                onChange={(e) => setFiltroArea(e.target.value)}
                className="biblio-select"
              >
                {areasDisponibles.map((a) => (
                  <option key={a} value={a}>
                    {a === "todas" ? "Todas las áreas" : a}
                  </option>
                ))}
              </select>
            </div>

            <div className="biblio-filtro-item">
              <label>Grado:</label>
              <select
                value={filtroGrado}
                onChange={(e) => setFiltroGrado(e.target.value)}
                className="biblio-select"
              >
                {gradosDisponibles.map((g) => (
                  <option key={g} value={g}>
                    {g === "todos" ? "Todos los grados" : g}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Lista de Planificaciones */}
        <div className="biblio-lista">
          {planesFiltrados.length === 0 ? (
            <div className="biblio-empty">
              <span className="biblio-empty-icon">📂</span>
              <h4>No hay planificaciones aquí</h4>
              <p>Genera una planificación o ajusta los filtros para ver tus documentos guardados.</p>
            </div>
          ) : (
            planesFiltrados.map((plan) => (
              <div
                key={plan.id}
                className={`biblio-card ${planSeleccionado?.id === plan.id ? "card-abierta" : ""}`}
                onClick={() => setPlanSeleccionado(planSeleccionado?.id === plan.id ? null : plan)}
              >
                <div className="biblio-card-header">
                  <h3 className="biblio-card-titulo">{plan.titulo}</h3>
                  <span className="biblio-card-fecha">
                    {new Date(plan.fecha).toLocaleDateString("es-DO", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric"
                    })}
                  </span>
                </div>

                <div className="biblio-card-badges">
                  <span className="biblio-badge badge-area">📚 {plan.area || "General"}</span>
                  <span className="biblio-badge badge-grado">🎓 {plan.grado || "Primaria"}</span>
                  <span className="biblio-badge badge-esquema">📋 {plan.esquemaLabel || "Esquema"}</span>
                  <span className="biblio-badge badge-periodo">⏱️ {plan.periodo || "Diaria"}</span>
                </div>

                {/* Acciones principales de la tarjeta */}
                <div className="biblio-card-actions">
                  <button
                    className="biblio-action-btn btn-cargar"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCargarEnApp(plan);
                    }}
                    title="Cargar esta planificación en la pantalla principal para editar"
                  >
                    ✏️ Ver / Editar
                  </button>

                  <button
                    className="biblio-action-btn btn-duplicar"
                    onClick={(e) => handleDuplicar(plan.id, e)}
                    title="Crear una copia para usar como plantilla"
                  >
                    📑 Duplicar
                  </button>

                  {onExportarWord && (
                    <button
                      className="biblio-action-btn btn-exportar"
                      onClick={(e) => {
                        e.stopPropagation();
                        const texto = Object.entries(plan.datosPlanificacion || {})
                          .map(([k, v]) => `${k}\n${v}`)
                          .join("\n\n");
                        onExportarWord(plan.titulo, texto);
                      }}
                      title="Exportar a Microsoft Word"
                    >
                      📄 Word
                    </button>
                  )}

                  <button
                    className="biblio-action-btn btn-eliminar"
                    onClick={(e) => handleEliminar(plan.id, e)}
                    title="Eliminar de la biblioteca"
                  >
                    🗑️
                  </button>
                </div>

                {/* Vista previa expandida si se toca la tarjeta */}
                {planSeleccionado?.id === plan.id && (
                  <div className="biblio-card-preview" onClick={(e) => e.stopPropagation()}>
                    <h5 className="preview-heading">Contenido del Esquema:</h5>
                    <div className="preview-campos-list">
                      {Object.entries(plan.datosPlanificacion || {}).map(([k, v]) => (
                        <div key={k} className="preview-campo-item">
                          <strong>{k}:</strong>
                          <p>{typeof v === "string" ? v : JSON.stringify(v)}</p>
                        </div>
                      ))}
                    </div>
                    <button
                      className="biblio-cargar-completo-btn"
                      onClick={() => handleCargarEnApp(plan)}
                    >
                      🚀 Abrir y Editar en Pantalla Principal
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
