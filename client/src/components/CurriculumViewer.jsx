import { useState, useMemo } from "react";
import { CURRICULUM_MINERD } from "../data/curriculumData.js";
import { consultarCurriculo } from "../services/api.js";

export default function CurriculumViewer({
  onCerrar,
  esquemaActivo = "primario",
  periodoActivo = "diaria",
  onAplicarAlEsquema
}) {
  const [nivelKey, setNivelKey] = useState("primario");
  const nivelActual = CURRICULUM_MINERD[nivelKey];

  const [gradoId, setGradoId] = useState(nivelActual.grados[0]?.id || "");
  const [areaId, setAreaId] = useState(nivelActual.areas[0]?.id || "");

  // Búsqueda de tema con IA
  const [temaInput, setTemaInput] = useState("");
  const [consultando, setConsultando] = useState(false);
  const [resultadoIA, setResultadoIA] = useState(null);
  const [errorIA, setErrorIA] = useState(null);

  // Al cambiar de nivel, actualizar grado y área iniciales
  function handleCambiarNivel(nuevoNivel) {
    setNivelKey(nuevoNivel);
    const n = CURRICULUM_MINERD[nuevoNivel];
    if (n.grados.length) setGradoId(n.grados[0].id);
    if (n.areas.length) setAreaId(n.areas[0].id);
  }

  const gradoActual = useMemo(() => {
    return nivelActual.grados.find((g) => g.id === gradoId) || nivelActual.grados[0];
  }, [nivelActual, gradoId]);

  const areaActual = useMemo(() => {
    return nivelActual.areas.find((a) => a.id === areaId) || nivelActual.areas[0];
  }, [nivelActual, areaId]);

  // Ejecutar búsqueda curricular con IA para un tema específico (Requisito 3 y 4a)
  async function handleConsultarIA(e) {
    if (e) e.preventDefault();
    if (!temaInput.trim()) return;

    // FASE 13: Comprobación offline antes de consultar IA
    if (!navigator.onLine) {
      setErrorIA("Se necesita conexión a internet para generar contenido nuevo con IA. Puedes seguir viendo tus planificaciones guardadas.");
      return;
    }

    setConsultando(true);
    setErrorIA(null);
    setResultadoIA(null);

    try {
      const data = await consultarCurriculo({
        nivel: nivelActual.nombre,
        grado: gradoActual.nombre,
        area: areaActual.nombre,
        tema: temaInput.trim(),
        esquemaActivo,
        periodoActivo
      });
      setResultadoIA(data);
    } catch (err) {
      if (!navigator.onLine || err.message?.includes("Failed to fetch") || err.message?.includes("NetworkError")) {
        setErrorIA("Se necesita conexión a internet para generar contenido nuevo con IA. Puedes seguir viendo tus planificaciones guardadas.");
      } else {
        setErrorIA(err.message || "Error consultando el currículo.");
      }
    } finally {
      setConsultando(false);
    }
  }

  // Confirmar y aplicar a la planificación activa (Requisito 4c)
  function handleAplicar() {
    if (!resultadoIA || !resultadoIA.datos_planificacion) return;
    if (onAplicarAlEsquema) {
      onAplicarAlEsquema(resultadoIA.datos_planificacion, resultadoIA.tema || temaInput);
    }
    onCerrar();
  }

  return (
    <div className="schema-overlay" onClick={onCerrar}>
      <div className="schema-panel cv-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="schema-header">
          <div className="cv-header-title">
            <span className="cv-header-icon">📚</span>
            <div>
              <h2>Currículo Oficial MINERD</h2>
              <small>Bases Curriculares y Asistente IA Integrado</small>
            </div>
          </div>
          <button className="schema-close-btn" onClick={onCerrar}>✕</button>
        </div>

        {/* 1. Selector de Nivel (Chips) */}
        <div className="cv-selector-nivel">
          {Object.entries(CURRICULUM_MINERD).map(([key, data]) => (
            <button
              key={key}
              className={`cv-nivel-chip ${nivelKey === key ? "active" : ""}`}
              onClick={() => handleCambiarNivel(key)}
            >
              {data.nombre}
            </button>
          ))}
        </div>

        {/* Filtros de Grado y Área */}
        <div className="cv-filtros-bar">
          <div className="cv-filtro-group">
            <label>Grado / Etapa:</label>
            <select
              value={gradoId}
              onChange={(e) => setGradoId(e.target.value)}
              className="cv-select"
            >
              {nivelActual.grados.map((g) => (
                <option key={g.id} value={g.id}>{g.nombre}</option>
              ))}
            </select>
          </div>

          <div className="cv-filtro-group">
            <label>Área Curricular:</label>
            <select
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
              className="cv-select"
            >
              {nivelActual.areas.map((a) => (
                <option key={a.id} value={a.id}>{a.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 3. Módulo IA: Búsqueda y Planificación por Tema */}
        <div className="cv-ia-box">
          <div className="cv-ia-header">
            <span className="cv-ia-tag">⚡ Asistente Curricular IA</span>
            <span className="cv-ia-context">{gradoActual.nombre} · {areaActual.nombre}</span>
          </div>
          <p className="cv-ia-desc">
            Indica un tema y la IA buscará las competencias, indicadores, contenidos y actividades oficiales para rellenar tu planificación:
          </p>
          <form onSubmit={handleConsultarIA} className="cv-ia-form">
            <input
              type="text"
              className="cv-ia-input"
              placeholder={`Ej: Geometría de ${gradoActual.nombre}, El Cuento, El Agua...`}
              value={temaInput}
              onChange={(e) => setTemaInput(e.target.value)}
            />
            <button
              type="submit"
              className="cv-ia-submit"
              disabled={consultando || !temaInput.trim()}
            >
              {consultando ? "Buscando..." : "🔍 Buscar con IA"}
            </button>
          </form>

          {errorIA && <div className="cv-error-banner">⚠️ {errorIA}</div>}

          {/* 4b. LISTA / RESUMEN DE REVISIÓN ANTES DE APLICAR */}
          {resultadoIA && (
            <div className="cv-resultado-preview">
              <div className="cv-preview-header">
                <div>
                  <h4 className="cv-preview-title">Resultado para: "{resultadoIA.tema}"</h4>
                  <small className="cv-preview-subtitle">
                    {resultadoIA.grado} — {resultadoIA.area}
                  </small>
                </div>
                <button className="cv-aplicar-btn" onClick={handleAplicar}>
                  ✓ Usar esta información en mi planificación
                </button>
              </div>

              {resultadoIA.resumen_enfoque && (
                <div className="cv-preview-enfoque">
                  💡 <strong>Enfoque MINERD:</strong> {resultadoIA.resumen_enfoque}
                </div>
              )}

              {/* Competencias Específicas */}
              {resultadoIA.competencias_especificas && (
                <div className="cv-preview-section">
                  <h5>🎯 Competencias Específicas:</h5>
                  <ul>
                    {resultadoIA.competencias_especificas.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Indicadores de Logro */}
              {resultadoIA.indicadores_logro && (
                <div className="cv-preview-section">
                  <h5>📊 Indicadores de Logro:</h5>
                  <ul>
                    {resultadoIA.indicadores_logro.map((ind, i) => (
                      <li key={i}>{ind}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Contenidos */}
              {resultadoIA.contenidos && (
                <div className="cv-preview-section">
                  <h5>📚 Contenidos:</h5>
                  <p><strong>Conceptuales:</strong> {resultadoIA.contenidos.conceptuales}</p>
                  <p><strong>Procedimentales:</strong> {resultadoIA.contenidos.procedimentales}</p>
                  <p><strong>Actitudinales:</strong> {resultadoIA.contenidos.actitudinales}</p>
                </div>
              )}

              {/* Estrategias Sugeridas */}
              {resultadoIA.estrategias_sugeridas && (
                <div className="cv-preview-section">
                  <h5>🧠 Estrategias Metodológicas Sugeridas:</h5>
                  <ul>
                    {resultadoIA.estrategias_sugeridas.map((est, i) => (
                      <li key={i}>{est}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actividades Sugeridas */}
              {resultadoIA.actividades_sugeridas && (
                <div className="cv-preview-section">
                  <h5>📝 Actividades de la Clase:</h5>
                  <p><strong>Inicio:</strong> {resultadoIA.actividades_sugeridas.inicio}</p>
                  <p><strong>Desarrollo:</strong> {resultadoIA.actividades_sugeridas.desarrollo}</p>
                  <p><strong>Cierre:</strong> {resultadoIA.actividades_sugeridas.cierre}</p>
                </div>
              )}

              {/* Botón de Confirmación al final */}
              <button className="cv-aplicar-btn cv-aplicar-bottom" onClick={handleAplicar}>
                ✓ Usar esta información en mi planificación
              </button>
            </div>
          )}
        </div>

        {/* 2. Bases Curriculares Oficiales (Explorador) */}
        <div className="cv-explorador-container">
          <div className="cv-explorador-title">
            <div>
              <h3>📖 Bases Curriculares: {areaActual.nombre}</h3>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                <span>{gradoActual.nombre}</span>
                <span className="pm-tag-referencial" style={{ fontSize: "11px", color: "#9a3412", background: "#ffedd5", border: "1px solid #fed7aa", padding: "2px 8px", borderRadius: "4px", fontWeight: "600" }}>
                  Muestra referencial local (no verificada)
                </span>
              </div>
            </div>
          </div>

          {/* Competencias Específicas */}
          <div className="cv-card-seccion">
            <h4 className="cv-card-header">🎯 Competencias Específicas</h4>
            <ul className="cv-card-list">
              {areaActual.competencias.map((comp, idx) => (
                <li key={idx}>{comp}</li>
              ))}
            </ul>
          </div>

          {/* Contenidos Oficiales */}
          <div className="cv-card-seccion">
            <h4 className="cv-card-header">📚 Contenidos Curriculares</h4>
            <div className="cv-contenidos-grid">
              <div className="cv-contenido-box">
                <span className="cv-tag-tipo">Conceptuales</span>
                <ul>
                  {areaActual.contenidos.conceptuales.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>

              <div className="cv-contenido-box">
                <span className="cv-tag-tipo">Procedimentales</span>
                <ul>
                  {areaActual.contenidos.procedimentales.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>

              <div className="cv-contenido-box">
                <span className="cv-tag-tipo">Actitudinales / Valores</span>
                <ul>
                  {areaActual.contenidos.actitudinales.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Indicadores de Logro */}
          <div className="cv-card-seccion">
            <h4 className="cv-card-header">📊 Indicadores de Logro Oficiales</h4>
            <ul className="cv-card-list">
              {areaActual.indicadores.map((ind, idx) => (
                <li key={idx}>{ind}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
