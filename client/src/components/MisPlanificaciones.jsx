import { useState, useMemo, useEffect } from "react";
import {
  obtenerTodasLasPlanificaciones,
  duplicarPlanEnBiblioteca,
  eliminarPlanDeBiblioteca,
  actualizarEstadoPlanEnBiblioteca
} from "../services/bibliotecaStorage.js";
import { enviarPlanACoordinacion } from "../services/coordinacionService.js";
import { cargarPerfil } from "../services/perfilStorage.js";

export default function MisPlanificaciones({
  onCerrar,
  onAbrirPlan,
  onExportarWord,
  onEscuchar,
  user,
  supabaseClient,
  planInicialId = null
}) {
  const [planes, setPlanes] = useState(() => obtenerTodasLasPlanificaciones(user?.id));
  const [filtroArea, setFiltroArea] = useState("todas");
  const [filtroGrado, setFiltroGrado] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [planSeleccionado, setPlanSeleccionado] = useState(() => {
    if (planInicialId) {
      const todos = obtenerTodasLasPlanificaciones(user?.id);
      return todos.find((p) => p.id === planInicialId) || null;
    }
    return null;
  });

  useEffect(() => {
    if (planInicialId) {
      const match = planes.find((p) => p.id === planInicialId);
      if (match) {
        setPlanSeleccionado(match);
        setFiltroArea("todas");
        setFiltroGrado("todos");
        setBusqueda("");
      }
    }
  }, [planInicialId, planes]);

  async function handleEnviarACoordinacion(plan, e) {
    if (e) e.stopPropagation();
    try {
      const perfil = cargarPerfil() || {};
      const docenteNombre = user?.user_metadata?.nombre || perfil?.nombre || "Docente";
      const escuelaId = user?.user_metadata?.escuela_id || perfil?.codigoMinerd;
      await enviarPlanACoordinacion({
        supabaseClient,
        plan,
        userId: user?.id,
        escuelaId,
        docenteNombre
      });
      actualizarEstadoPlanEnBiblioteca(plan.id, "enviada_revision", null, user?.id);
      setPlanes(obtenerTodasLasPlanificaciones(user?.id));
      alert("¡Planificación enviada a Coordinación para revisión!");
    } catch (err) {
      alert("Error enviando a coordinación: " + err.message);
    }
  }

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
                  {(() => {
                    const badgeEstado = {
                      enviada_revision: { bg: "#fffbeb", color: "#b45309", text: "⏳ En Revisión" },
                      aprobada: { bg: "#f0fdf4", color: "#166534", text: "✅ Aprobada" },
                      observada: { bg: "#faf5ff", color: "#7e22ce", text: "💬 Con Observaciones" },
                      borrador: { bg: "#f1f5f9", color: "#475569", text: "📝 Borrador" }
                    }[plan.estado || "borrador"] || { bg: "#f1f5f9", color: "#475569", text: "📝 Borrador" };

                    return (
                      <span
                        className="biblio-badge"
                        style={{ background: badgeEstado.bg, color: badgeEstado.color, fontWeight: "700" }}
                      >
                        {badgeEstado.text}
                      </span>
                    );
                  })()}
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

                  {plan.estado !== "enviada_revision" && plan.estado !== "aprobada" && (
                    <button
                      className="biblio-action-btn"
                      onClick={(e) => handleEnviarACoordinacion(plan, e)}
                      title="Enviar a Coordinación Pedagógica para revisión oficial"
                      style={{ background: "#f0fdfa", color: "#0d9488", border: "1px solid #99f6e4", fontWeight: "600" }}
                    >
                      📤 Enviar
                    </button>
                  )}

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
                    {plan.ultimaRevision && (
                      <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "10px", marginBottom: "12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                          <strong style={{ fontSize: "12px", color: plan.ultimaRevision.estado_revision === "aprobada" ? "#166534" : "#b45309" }}>
                            {plan.ultimaRevision.estado_revision === "aprobada" ? "✓ Dictamen de Coordinación: Aprobada" : "⚠️ Dictamen de Coordinación: Con Observaciones"}
                          </strong>
                          <span style={{ fontSize: "11px", color: "#64748b" }}>
                            {new Date(plan.ultimaRevision.fecha_revision).toLocaleDateString()}
                          </span>
                        </div>
                        {plan.ultimaRevision.comentarios_generales && (
                          <p style={{ margin: "4px 0", fontSize: "12px", color: "#334155" }}>
                            {plan.ultimaRevision.comentarios_generales}
                          </p>
                        )}
                        {plan.ultimaRevision.bloques_observados?.dua && (
                          <p style={{ margin: "4px 0", fontSize: "12px", color: "#0f766e", fontStyle: "italic" }}>
                            Sugerencias DUA: {plan.ultimaRevision.bloques_observados.dua}
                          </p>
                        )}
                      </div>
                    )}
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
