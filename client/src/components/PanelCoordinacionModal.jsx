import { useState, useEffect, useMemo } from "react";
import {
  obtenerPlanificacionesParaSupervision,
  guardarRevisionPedagogica,
  obtenerRevisionesPlan
} from "../services/coordinacionService.js";
import { exportarWord } from "../services/api.js";
import { cargarPerfil } from "../services/perfilStorage.js";
import { descargarInformeSupervisionWord } from "../services/generadorInformeSupervisionWord.js";
import { calcularAnaliticaInstitucional } from "../services/analiticaCurricularService.js";

// Plantillas de sugerencias pedagógicas oficiales MINERD para retroalimentación rápida
const SUGERENCIAS_COMENTARIOS_MINERD = [
  {
    etiqueta: "Saberes Previos",
    texto: "Fortalecer el momento de Inicio garantizando la recuperación de saberes previos y explicitando la intención pedagógica del día."
  },
  {
    etiqueta: "Secuencia CON BASE",
    texto: "Secuencia didáctica alineada al programa CON BASE; se sugiere profundizar en la modelación docente antes de la práctica autónoma."
  },
  {
    etiqueta: "Evaluación y Rúbricas",
    texto: "Diversificar los instrumentos de evaluación formativa (rúbricas y listas de cotejo) articulados a los criterios del Registro de Grado."
  },
  {
    etiqueta: "Cierre Metacognitivo",
    texto: "Consolidar el momento de Cierre incorporando preguntas de metacognición (¿qué aprendimos?, ¿para qué nos sirve?) y síntesis colectiva."
  },
  {
    etiqueta: "Alineación Excelente",
    texto: "Excelente congruencia entre competencias específicas, contenidos curriculares y momentos de clase según la Malla MINERD."
  }
];

// Plantillas de sugerencias DUA para atención a la diversidad (NEAE)
const SUGERENCIAS_DUA_MINERD = [
  {
    etiqueta: "Apoyos Visuales",
    texto: "Incorporar apoyos visuales, organizadores gráficos y material concreto para facilitar el acceso multisensorial al contenido."
  },
  {
    etiqueta: "Tiempo Extendido",
    texto: "Dosificar las tareas complejas y otorgar tiempo extendido en consignas de trabajo individual para estudiantes con NEAE."
  },
  {
    etiqueta: "Lectura Fácil",
    texto: "Adaptar textos a formato de lectura fácil y combinar explicaciones orales con modelado guiado paso a paso."
  },
  {
    etiqueta: "Tutoría entre Pares",
    texto: "Fomentar el aprendizaje colaborativo mediante tutoría entre pares para fortalecer la inclusión académica y socioemocional."
  }
];

export default function PanelCoordinacionModal({
  onCerrar,
  user,
  supabaseClient,
  onAbrirPlan
}) {
  const [planes, setPlanes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [vistaActiva, setVistaActiva] = useState("planes"); // "planes" | "analitica"
  const [filtroEstado, setFiltroEstado] = useState("todas");
  const [filtroGrado, setFiltroGrado] = useState("todos");
  const [filtroArea, setFiltroArea] = useState("todas");
  const [busqueda, setBusqueda] = useState("");
  const [planSeleccionado, setPlanSeleccionado] = useState(null);
  const [revisionesActuales, setRevisionesActuales] = useState([]);
  const [guardandoRevision, setGuardandoRevision] = useState(false);
  const [generandoInformeDocx, setGenerandoInformeDocx] = useState(false);
  const [mensajeExito, setMensajeExito] = useState(null);

  // Formulario de dictamen
  const [estadoRevision, setEstadoRevision] = useState("aprobada");
  const [comentarios, setComentarios] = useState("");
  const [sugerenciasDua, setSugerenciasDua] = useState("");
  const [observacionSecuencia, setObservacionSecuencia] = useState("");

  const perfil = cargarPerfil() || {};
  const escuelaNombre = user?.user_metadata?.escuela || perfil?.escuela || "Centro Educativo MINERD";
  const escuelaCodigo = user?.user_metadata?.codigoMinerd || perfil?.codigoMinerd || "";
  const rolUsuario = user?.user_metadata?.rol || perfil?.rol || "coordinador_area";

  // Cargar planificaciones al abrir
  useEffect(() => {
    async function cargar() {
      setCargando(true);
      try {
        const datos = await obtenerPlanificacionesParaSupervision({
          supabaseClient,
          escuelaId: user?.user_metadata?.escuela_id,
          rol: rolUsuario,
          userId: user?.id
        });
        setPlanes(datos);
      } catch (err) {
        console.error("Error al cargar planificaciones institucionales:", err);
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [user, supabaseClient, rolUsuario]);

  // Contadores para métricas rápidas
  const metricas = useMemo(() => {
    const total = planes.length;
    const pendientes = planes.filter((p) => p.estado === "enviada_revision").length;
    const aprobadas = planes.filter((p) => p.estado === "aprobada").length;
    const observadas = planes.filter((p) => p.estado === "observada").length;
    return { total, pendientes, aprobadas, observadas };
  }, [planes]);

  // Analítica curricular y cobertura institucional completa
  const analitica = useMemo(() => {
    return calcularAnaliticaInstitucional(planes);
  }, [planes]);

  // Extracción dinámica de grados únicos presentes en los planes escolares
  const listaGrados = useMemo(() => {
    const set = new Set();
    for (const p of planes) {
      if (p.grado && String(p.grado).trim()) {
        set.add(String(p.grado).trim());
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  }, [planes]);

  // Extracción dinámica de áreas curriculares únicas presentes en los planes escolares
  const listaAreas = useMemo(() => {
    const set = new Set();
    for (const p of planes) {
      if (p.area && String(p.area).trim()) {
        set.add(String(p.area).trim());
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [planes]);

  const hayFiltrosActivos = useMemo(() => {
    return (
      filtroEstado !== "todas" ||
      filtroGrado !== "todos" ||
      filtroArea !== "todas" ||
      busqueda.trim() !== ""
    );
  }, [filtroEstado, filtroGrado, filtroArea, busqueda]);

  function handleLimpiarFiltros() {
    setFiltroEstado("todas");
    setFiltroGrado("todos");
    setFiltroArea("todas");
    setBusqueda("");
  }

  // Filtrado reactivo multidimensional (Estado + Grado + Área + Búsqueda)
  const planesFiltrados = useMemo(() => {
    return planes.filter((p) => {
      const matchEstado =
        filtroEstado === "todas" ||
        (filtroEstado === "enviada_revision" && p.estado === "enviada_revision") ||
        (filtroEstado === "aprobada" && p.estado === "aprobada") ||
        (filtroEstado === "observada" && p.estado === "observada");

      const matchGrado =
        filtroGrado === "todos" ||
        (p.grado && p.grado.toLowerCase().trim() === filtroGrado.toLowerCase().trim());

      const matchArea =
        filtroArea === "todas" ||
        (p.area && p.area.toLowerCase().trim() === filtroArea.toLowerCase().trim());

      const matchBusqueda =
        !busqueda.trim() ||
        p.titulo?.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.area?.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.grado?.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.docenteNombre?.toLowerCase().includes(busqueda.toLowerCase());

      return matchEstado && matchGrado && matchArea && matchBusqueda;
    });
  }, [planes, filtroEstado, filtroGrado, filtroArea, busqueda]);

  function handleInsertarComentario(texto) {
    setComentarios((prev) => {
      const limpia = prev ? prev.trim() : "";
      if (!limpia) return texto;
      if (limpia.includes(texto)) return limpia;
      return `${limpia} ${texto}`;
    });
  }

  function handleInsertarDua(texto) {
    setSugerenciasDua((prev) => {
      const limpia = prev ? prev.trim() : "";
      if (!limpia) return texto;
      if (limpia.includes(texto)) return limpia;
      return `${limpia} ${texto}`;
    });
  }

  // Seleccionar plan para revisar
  async function handleSeleccionarPlan(plan) {
    setPlanSeleccionado(plan);
    setMensajeExito(null);
    setComentarios("");
    setSugerenciasDua("");
    setObservacionSecuencia("");
    setEstadoRevision("aprobada");

    try {
      const revs = await obtenerRevisionesPlan({
        supabaseClient,
        planificacionId: plan.id
      });
      setRevisionesActuales(revs);
    } catch (e) {
      setRevisionesActuales([]);
    }
  }

  // Enviar dictamen pedagógico
  async function handleGuardarDictamen(e) {
    e.preventDefault();
    if (!planSeleccionado) return;

    setGuardandoRevision(true);
    try {
      const { revision, nuevoEstadoPlan } = await guardarRevisionPedagogica({
        supabaseClient,
        planificacionId: planSeleccionado.id,
        targetDocenteId: planSeleccionado.docente_id,
        coordinadorId: user?.id,
        coordinadorNombre: user?.user_metadata?.nombre || perfil?.nombre || "Coordinador Pedagógico",
        estadoRevision,
        comentariosGenerales: comentarios.trim(),
        bloquesObservados: {
          secuencia_didactica: observacionSecuencia.trim(),
          dua: sugerenciasDua.trim()
        }
      });

      // Actualizar en el estado local de la lista
      setPlanes((prev) =>
        prev.map((p) =>
          p.id === planSeleccionado.id
            ? { ...p, estado: nuevoEstadoPlan, ultimaRevision: revision }
            : p
        )
      );

      setPlanSeleccionado((prev) =>
        prev ? { ...prev, estado: nuevoEstadoPlan, ultimaRevision: revision } : null
      );

      setRevisionesActuales((prev) => [revision, ...prev]);
      setMensajeExito("¡Dictamen pedagógico registrado y notificado exitosamente!");
      setTimeout(() => setMensajeExito(null), 3500);
    } catch (err) {
      alert("Error al guardar dictamen: " + err.message);
    } finally {
      setGuardandoRevision(false);
    }
  }

  async function handleExportarWord(plan, e) {
    if (e) e.stopPropagation();
    try {
      const rev = plan.ultimaRevision || (Array.isArray(plan.revisiones) ? plan.revisiones[0] : null);
      await exportarWord(plan.datosPlanificacion || plan, {
        nombreDocente: plan.docenteNombre || perfil?.nombre,
        escuela: escuelaNombre,
        revision: rev
      });
    } catch (err) {
      alert("Error exportando a Word: " + err.message);
    }
  }

  async function handleDescargarInformeWord() {
    setGenerandoInformeDocx(true);
    try {
      // Si el coordinador aplicó filtro focalizado por grado o área, exportar dicho conjunto
      const planesAExportar =
        (filtroGrado !== "todos" || filtroArea !== "todas") && planesFiltrados.length > 0
          ? planesFiltrados
          : planes;

      await descargarInformeSupervisionWord({
        escuelaInfo: {
          nombre: escuelaNombre,
          codigoMinerd: escuelaCodigo,
          regional: perfil?.regional,
          distrito: perfil?.distrito,
          tanda: perfil?.tanda
        },
        planes: planesAExportar,
        revisiones: revisionesActuales,
        coordinadorNombre: user?.user_metadata?.nombre || perfil?.nombre || "Coordinador/a Pedagógico/a",
        directorNombre: perfil?.directorNombre || "Director/a del Centro Educativo"
      });
    } catch (err) {
      console.error("Error al generar informe de supervisión Word:", err);
      alert("Error generando informe de supervisión: " + err.message);
    } finally {
      setGenerandoInformeDocx(false);
    }
  }

  return (
    <div className="schema-overlay" onClick={onCerrar}>
      <div
        className="schema-panel"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "860px", width: "95%", maxHeight: "90vh", display: "flex", flexDirection: "column" }}
      >
        {/* Cabecera Oficial */}
        <div className="schema-header" style={{ borderBottom: "2px solid #0d9488", paddingBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "24px" }}>📋</span>
              <h2 style={{ margin: 0, fontSize: "19px", color: "#0f766e" }}>
                Supervisión y Coordinación Pedagógica
              </h2>
            </div>
            <p style={{ margin: "4px 0 0 32px", fontSize: "12px", color: "#64748b" }}>
              {escuelaNombre} {escuelaCodigo && `• SIGERD: ${escuelaCodigo}`} • MINERD
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              type="button"
              onClick={handleDescargarInformeWord}
              disabled={generandoInformeDocx}
              style={{
                background: "#0f766e",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "7px 13px",
                fontSize: "12px",
                fontWeight: "600",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                cursor: generandoInformeDocx ? "wait" : "pointer",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
              }}
              title="Descargar informe mensual de supervisión pedagógica en formato Word (.docx) oficial MINERD"
            >
              <span>📥</span>
              <span>{generandoInformeDocx ? "Generando..." : "Informe Mensual (.docx)"}</span>
            </button>
            <button className="schema-close-btn" onClick={onCerrar}>✕</button>
          </div>
        </div>

        {/* Aviso de versión de prueba / beta abierta */}
        <div
          role="note"
          style={{
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: "8px",
            padding: "9px 12px",
            marginTop: "12px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: "#92400e",
            fontSize: "12px",
            lineHeight: "1.4"
          }}
        >
          <span style={{ fontSize: "16px", flexShrink: 0 }}>ℹ️</span>
          <span>
            En esta versión de prueba, la coordinación funciona solo en este dispositivo. La sincronización entre docentes y coordinadores estará disponible en la versión oficial con cuentas.
          </span>
        </div>

        {/* Selector de Pestañas: Supervisión vs Analítica */}
        <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid #e2e8f0", paddingBottom: "10px", marginTop: "10px" }}>
          <button
            type="button"
            onClick={() => setVistaActiva("planes")}
            style={{
              padding: "7px 16px",
              borderRadius: "8px",
              border: vistaActiva === "planes" ? "1.5px solid #0d9488" : "1px solid #e2e8f0",
              background: vistaActiva === "planes" ? "#f0fdfa" : "#ffffff",
              color: vistaActiva === "planes" ? "#0f766e" : "#64748b",
              fontWeight: vistaActiva === "planes" ? "700" : "500",
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <span>📋</span>
            <span>Supervisión y Planes ({planes.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setVistaActiva("analitica")}
            style={{
              padding: "7px 16px",
              borderRadius: "8px",
              border: vistaActiva === "analitica" ? "1.5px solid #0d9488" : "1px solid #e2e8f0",
              background: vistaActiva === "analitica" ? "#f0fdfa" : "#ffffff",
              color: vistaActiva === "analitica" ? "#0f766e" : "#64748b",
              fontWeight: vistaActiva === "analitica" ? "700" : "500",
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <span>📈</span>
            <span>Analítica y Cobertura Curricular</span>
          </button>
        </div>

        {vistaActiva === "planes" ? (
          <>
            {/* Tarjetas de Métricas */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px", margin: "14px 0" }}>
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "10px", textAlign: "center" }}>
            <span style={{ display: "block", fontSize: "11px", color: "#64748b", fontWeight: "600" }}>Total Planes</span>
            <strong style={{ fontSize: "20px", color: "#1e293b" }}>{metricas.total}</strong>
          </div>
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "10px", padding: "10px", textAlign: "center" }}>
            <span style={{ display: "block", fontSize: "11px", color: "#92400e", fontWeight: "600" }}>Por Revisar</span>
            <strong style={{ fontSize: "20px", color: "#b45309" }}>{metricas.pendientes}</strong>
          </div>
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px", padding: "10px", textAlign: "center" }}>
            <span style={{ display: "block", fontSize: "11px", color: "#166534", fontWeight: "600" }}>Aprobadas</span>
            <strong style={{ fontSize: "20px", color: "#15803d" }}>{metricas.aprobadas}</strong>
          </div>
          <div style={{ background: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: "10px", padding: "10px", textAlign: "center" }}>
            <span style={{ display: "block", fontSize: "11px", color: "#6b21a8", fontWeight: "600" }}>Con Observaciones</span>
            <strong style={{ fontSize: "20px", color: "#7e22ce" }}>{metricas.observadas}</strong>
          </div>
        </div>

        {/* Barra de Filtros y Búsqueda Multidimensional */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "14px" }}>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <input
              type="text"
              placeholder="🔍 Buscar por docente, título, tema..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{
                flex: "1 1 200px",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "13px"
              }}
            />

            {/* Selector de Grado */}
            <select
              value={filtroGrado}
              onChange={(e) => setFiltroGrado(e.target.value)}
              aria-label="Filtrar por Grado"
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: filtroGrado !== "todos" ? "1.5px solid #0d9488" : "1px solid #cbd5e1",
                background: filtroGrado !== "todos" ? "#ccfbf1" : "#ffffff",
                color: filtroGrado !== "todos" ? "#0f766e" : "#334155",
                fontWeight: filtroGrado !== "todos" ? "600" : "normal",
                fontSize: "13px",
                cursor: "pointer"
              }}
              title="Filtrar planificaciones por grado escolar"
            >
              <option value="todos">🎓 Todos los Grados</option>
              {listaGrados.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>

            {/* Selector de Área Curricular */}
            <select
              value={filtroArea}
              onChange={(e) => setFiltroArea(e.target.value)}
              aria-label="Filtrar por Área Curricular"
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: filtroArea !== "todas" ? "1.5px solid #0d9488" : "1px solid #cbd5e1",
                background: filtroArea !== "todas" ? "#ccfbf1" : "#ffffff",
                color: filtroArea !== "todas" ? "#0f766e" : "#334155",
                fontWeight: filtroArea !== "todas" ? "600" : "normal",
                fontSize: "13px",
                cursor: "pointer"
              }}
              title="Filtrar planificaciones por área curricular MINERD"
            >
              <option value="todas">📚 Todas las Áreas</option>
              {listaAreas.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>

            {hayFiltrosActivos && (
              <button
                type="button"
                onClick={handleLimpiarFiltros}
                style={{
                  background: "#f1f5f9",
                  color: "#475569",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  padding: "7px 11px",
                  fontSize: "12px",
                  fontWeight: "500",
                  cursor: "pointer"
                }}
                title="Limpiar todos los filtros"
              >
                ✕ Limpiar
              </button>
            )}
          </div>

          {/* Fila de Estados y Conteo */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {[
                { id: "todas", label: "Todas" },
                { id: "enviada_revision", label: "Por Revisar" },
                { id: "aprobada", label: "Aprobadas" },
                { id: "observada", label: "Observadas" }
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFiltroEstado(f.id)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: filtroEstado === f.id ? "700" : "500",
                    border: filtroEstado === f.id ? "1.5px solid #0d9488" : "1px solid #e2e8f0",
                    background: filtroEstado === f.id ? "#ccfbf1" : "#ffffff",
                    color: filtroEstado === f.id ? "#0f766e" : "#475569",
                    cursor: "pointer"
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <span style={{ fontSize: "12px", color: "#64748b" }}>
              Mostrando <strong>{planesFiltrados.length}</strong> de {planes.length} {planes.length === 1 ? "plan" : "planes"}
            </span>
          </div>
        </div>

        {/* Contenido Principal: Lista o Detalle de Revisión */}
        <div style={{ flex: 1, overflowY: "auto", paddingRight: "4px" }}>
          {cargando ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
              Cargando planificaciones escolares...
            </div>
          ) : planSeleccionado ? (
            /* Vista de Revisión y Dictamen */
            <div style={{ background: "#ffffff", borderRadius: "10px", border: "1px solid #e2e8f0", padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                <div>
                  <button
                    type="button"
                    onClick={() => setPlanSeleccionado(null)}
                    style={{ background: "none", border: "none", color: "#0d9488", fontWeight: "600", cursor: "pointer", padding: 0, fontSize: "13px", marginBottom: "6px" }}
                  >
                    ← Volver a la lista
                  </button>
                  <h3 style={{ margin: "2px 0", fontSize: "17px", color: "#1e293b" }}>{planSeleccionado.titulo}</h3>
                  <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
                    Docente: <strong>{planSeleccionado.docenteNombre || "Docente"}</strong> • {planSeleccionado.grado} • {planSeleccionado.area}
                  </p>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={(e) => handleExportarWord(planSeleccionado, e)}
                    style={{ background: "#f0fdfa", border: "1px solid #99f6e4", color: "#0f766e", padding: "6px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
                  >
                    📄 Descargar Word
                  </button>
                  {onAbrirPlan && (
                    <button
                      type="button"
                      onClick={() => { onAbrirPlan(planSeleccionado); onCerrar(); }}
                      style={{ background: "#0d9488", border: "none", color: "white", padding: "6px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
                    >
                      👁️ Abrir en App
                    </button>
                  )}
                </div>
              </div>

              {planSeleccionado.ciclo_revision && planSeleccionado.ciclo_revision > 1 && (
                <div style={{ display: "inline-block", background: "#e0f2fe", color: "#0369a1", border: "1px solid #bae6fd", padding: "3px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: "700", marginBottom: "8px" }}>
                  🔄 Reenvío para Supervisión (Ciclo {planSeleccionado.ciclo_revision})
                </div>
              )}

              {planSeleccionado.notaDocente && (
                <div style={{ background: "#f0fdfa", border: "1.5px solid #5eead4", borderRadius: "8px", padding: "10px 14px", marginBottom: "12px" }}>
                  <strong style={{ fontSize: "12.5px", color: "#0f766e" }}>
                    📝 Nota de Entrega y Ajustes del Docente:
                  </strong>
                  <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#115e59" }}>
                    "{planSeleccionado.notaDocente}"
                  </p>
                </div>
              )}

              {mensajeExito && (
                <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46", padding: "10px 14px", borderRadius: "8px", fontSize: "13px", marginBottom: "14px" }}>
                  ✓ {mensajeExito}
                </div>
              )}

              {/* Formulario de Dictamen Pedagógico */}
              <form onSubmit={handleGuardarDictamen} style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "10px", padding: "14px", marginTop: "10px" }}>
                <h4 style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#0f766e", fontWeight: "700" }}>
                  Dictamen Pedagógico del Acompañamiento
                </h4>

                <div style={{ marginBottom: "10px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#334155", marginBottom: "4px" }}>
                    Resolución:
                  </label>
                  <select
                    value={estadoRevision}
                    onChange={(e) => setEstadoRevision(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                  >
                    <option value="aprobada">✅ Aprobada (Cumple con los momentos de clase y diseño MINERD)</option>
                    <option value="requiere_ajustes">⚠️ Requiere Ajustes (Devolver al docente con observaciones)</option>
                    <option value="sugerencias">💡 Aprobada con Sugerencias Didácticas</option>
                  </select>
                </div>

                <div style={{ marginBottom: "12px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#334155", marginBottom: "4px" }}>
                    Comentarios Pedagógicos Generales:
                  </label>
                  {/* Plantillas rápidas de retroalimentación pedagógica */}
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "6px" }}>
                    {SUGERENCIAS_COMENTARIOS_MINERD.map((s) => (
                      <button
                        key={s.etiqueta}
                        type="button"
                        onClick={() => handleInsertarComentario(s.texto)}
                        style={{
                          background: "#f1f5f9",
                          border: "1px solid #cbd5e1",
                          borderRadius: "14px",
                          padding: "3px 8px",
                          fontSize: "11px",
                          color: "#334155",
                          cursor: "pointer",
                          fontWeight: "500"
                        }}
                        title={s.texto}
                      >
                        + {s.etiqueta}
                      </button>
                    ))}
                  </div>
                  <textarea
                    rows={3}
                    placeholder="Escribe observaciones sobre la secuencia, actividades de inicio/desarrollo/cierre..."
                    value={comentarios}
                    onChange={(e) => setComentarios(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>

                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#334155", marginBottom: "4px" }}>
                    Recomendaciones DUA (Atención a la Diversidad / NEAE):
                  </label>
                  {/* Plantillas rápidas DUA */}
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "6px" }}>
                    {SUGERENCIAS_DUA_MINERD.map((s) => (
                      <button
                        key={s.etiqueta}
                        type="button"
                        onClick={() => handleInsertarDua(s.texto)}
                        style={{
                          background: "#f0fdfa",
                          border: "1px solid #99f6e4",
                          borderRadius: "14px",
                          padding: "3px 8px",
                          fontSize: "11px",
                          color: "#0f766e",
                          cursor: "pointer",
                          fontWeight: "500"
                        }}
                        title={s.texto}
                      >
                        + {s.etiqueta}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    placeholder="Ej: Proporcionar apoyos visuales y tiempo extendido para estudiantes que lo requieran..."
                    value={sugerenciasDua}
                    onChange={(e) => setSugerenciasDua(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={guardandoRevision}
                  style={{
                    background: "#0d9488",
                    color: "white",
                    border: "none",
                    padding: "9px 18px",
                    borderRadius: "8px",
                    fontWeight: "700",
                    fontSize: "13px",
                    cursor: "pointer",
                    boxShadow: "0 2px 4px rgba(13, 148, 136, 0.2)"
                  }}
                >
                  {guardandoRevision ? "Guardando Dictamen..." : "💾 Guardar y Notificar Dictamen"}
                </button>
              </form>

              {/* Historial de Revisiones */}
              {revisionesActuales.length > 0 && (
                <div style={{ marginTop: "16px" }}>
                  <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#475569" }}>
                    Historial de Revisiones Realizadas ({revisionesActuales.length})
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {revisionesActuales.map((rev) => (
                      <div key={rev.id} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "10px", fontSize: "12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                          <span style={{ fontWeight: "700", color: rev.estado_revision === "aprobada" ? "#166534" : "#b45309" }}>
                            {rev.estado_revision === "aprobada" ? "✓ Aprobada" : "⚠️ Observada"}
                          </span>
                          <span style={{ color: "#94a3b8" }}>{new Date(rev.fecha_revision).toLocaleDateString()}</span>
                        </div>
                        {rev.comentarios_generales && <p style={{ margin: "4px 0", color: "#334155" }}>{rev.comentarios_generales}</p>}
                        {rev.bloques_observados?.dua && (
                          <p style={{ margin: "4px 0", color: "#0f766e", fontStyle: "italic" }}>
                            DUA: {rev.bloques_observados.dua}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : planesFiltrados.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
              No hay planificaciones con los filtros seleccionados.
            </div>
          ) : (
            /* Lista de Planificaciones */
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {planesFiltrados.map((p) => {
                const estadoBadge = {
                  enviada_revision: { bg: "#fffbeb", color: "#b45309", border: "#fde68a", text: "⏳ Por Revisar" },
                  aprobada: { bg: "#f0fdf4", color: "#166534", border: "#bbf7d0", text: "✅ Aprobada" },
                  observada: { bg: "#faf5ff", color: "#7e22ce", border: "#e9d5ff", text: "💬 Con Observaciones" },
                  borrador: { bg: "#f1f5f9", color: "#475569", border: "#cbd5e1", text: "📝 Borrador" }
                }[p.estado] || { bg: "#f1f5f9", color: "#475569", border: "#cbd5e1", text: p.estado };

                // Detección de contenido DUA o adaptaciones inclusivas
                const tieneDua = Boolean(
                  (p.ultimaRevision?.bloques_observados?.dua && p.ultimaRevision.bloques_observados.dua.trim()) ||
                  (p.datosPlanificacion?.dua && String(p.datosPlanificacion.dua).trim()) ||
                  (p.datosPlanificacion?.actividades_diferenciadas && String(p.datosPlanificacion.actividades_diferenciadas).trim())
                );

                // Cálculo de antigüedad para SLA pedagógico (enviada_revision)
                let alertaAntiguedad = null;
                const fechaBase = p.fecha_envio || p.actualizado_en || p.creado_en;
                if (p.estado === "enviada_revision" && fechaBase) {
                  const diasEspera = Math.floor((Date.now() - new Date(fechaBase).getTime()) / (1000 * 60 * 60 * 24));
                  if (diasEspera >= 3) {
                    alertaAntiguedad = {
                      texto: `⚡ En espera (> ${diasEspera} días)`,
                      bg: "#fef2f2",
                      color: "#991b1b",
                      border: "#fecaca"
                    };
                  } else if (diasEspera > 0) {
                    alertaAntiguedad = {
                      texto: `⏱️ Enviado hace ${diasEspera}d`,
                      bg: "#fefce8",
                      color: "#854d0e",
                      border: "#fef08a"
                    };
                  } else {
                    alertaAntiguedad = {
                      texto: "⏱️ Enviado hoy",
                      bg: "#f0fdf4",
                      color: "#166534",
                      border: "#bbf7d0"
                    };
                  }
                }

                // Fecha formateada para visualización
                const fechaMostrar = p.ultimaRevision?.fecha_revision
                  ? `Dictamen: ${new Date(p.ultimaRevision.fecha_revision).toLocaleDateString()}`
                  : fechaBase
                    ? `Enviado: ${new Date(fechaBase).toLocaleDateString()}`
                    : null;

                const observacionSnippet = p.ultimaRevision?.comentarios_generales
                  ? (p.ultimaRevision.comentarios_generales.length > 90
                      ? p.ultimaRevision.comentarios_generales.substring(0, 90) + "..."
                      : p.ultimaRevision.comentarios_generales)
                  : null;

                const duaSnippet = p.ultimaRevision?.bloques_observados?.dua
                  ? (p.ultimaRevision.bloques_observados.dua.length > 70
                      ? p.ultimaRevision.bloques_observados.dua.substring(0, 70) + "..."
                      : p.ultimaRevision.bloques_observados.dua)
                  : null;

                return (
                  <div
                    key={p.id}
                    onClick={() => handleSeleccionarPlan(p)}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "10px",
                      padding: "12px 14px",
                      background: "#ffffff",
                      cursor: "pointer",
                      transition: "box-shadow 0.15s, border-color 0.15s",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "12px"
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Fila de Insignias de Estado y Metadatos */}
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginBottom: "6px" }}>
                        <span
                          style={{
                            background: estadoBadge.bg,
                            color: estadoBadge.color,
                            border: `1px solid ${estadoBadge.border}`,
                            padding: "2px 8px",
                            borderRadius: "12px",
                            fontSize: "11px",
                            fontWeight: "700"
                          }}
                        >
                          {estadoBadge.text}
                        </span>

                        {tieneDua && (
                          <span
                            style={{
                              background: "#f0fdfa",
                              color: "#0f766e",
                              border: "1px solid #99f6e4",
                              padding: "2px 7px",
                              borderRadius: "12px",
                              fontSize: "11px",
                              fontWeight: "600"
                            }}
                            title="Incluye adecuaciones curriculares y Diseño Universal para el Aprendizaje (DUA / NEAE)"
                          >
                            🧩 DUA / Inclusiva
                          </span>
                        )}

                        {p.ciclo_revision && p.ciclo_revision > 1 && (
                          <span
                            style={{
                              background: "#e0f2fe",
                              color: "#0369a1",
                              border: "1px solid #bae6fd",
                              padding: "2px 7px",
                              borderRadius: "12px",
                              fontSize: "11px",
                              fontWeight: "700"
                            }}
                            title={`Plan reenviado tras adecuaciones (Ciclo ${p.ciclo_revision})`}
                          >
                            🔄 Reenvío (Ciclo {p.ciclo_revision})
                          </span>
                        )}

                        {alertaAntiguedad && (
                          <span
                            style={{
                              background: alertaAntiguedad.bg,
                              color: alertaAntiguedad.color,
                              border: `1px solid ${alertaAntiguedad.border}`,
                              padding: "2px 7px",
                              borderRadius: "12px",
                              fontSize: "11px",
                              fontWeight: "600"
                            }}
                          >
                            {alertaAntiguedad.texto}
                          </span>
                        )}

                        {fechaMostrar && (
                          <span style={{ fontSize: "11px", color: "#94a3b8", marginLeft: "auto" }}>
                            🗓️ {fechaMostrar}
                          </span>
                        )}
                      </div>

                      {/* Título y Datos Curriculares */}
                      <h4 style={{ margin: "0 0 4px 0", fontSize: "14px", color: "#1e293b", fontWeight: "700" }}>
                        {p.titulo}
                      </h4>
                      <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
                        👤 Docente: <strong style={{ color: "#334155" }}>{p.docenteNombre || "Docente"}</strong> • 🎓 {p.grado} • 📚 {p.area} • ⏱️ {p.periodo || "diaria"}
                      </p>

                      {/* Nota de Ajustes del Docente si existe */}
                      {p.notaDocente && (
                        <div style={{ marginTop: "6px", background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: "6px", padding: "6px 10px", fontSize: "11px" }}>
                          <span style={{ color: "#0f766e", fontWeight: "700" }}>
                            📝 Nota de Ajustes del Docente:
                          </span>
                          <p style={{ margin: "2px 0 0 0", color: "#134e4a" }}>
                            "{p.notaDocente}"
                          </p>
                        </div>
                      )}

                      {/* Snippet de Observación Pedagógica si está observada */}
                      {p.estado === "observada" && (observacionSnippet || duaSnippet) && (
                        <div style={{ marginTop: "8px", background: "#faf5ff", border: "1px solid #f3e8ff", borderRadius: "6px", padding: "6px 10px", fontSize: "11px" }}>
                          {observacionSnippet && (
                            <p style={{ margin: 0, color: "#6b21a8" }}>
                              💬 <em>"{observacionSnippet}"</em>
                            </p>
                          )}
                          {duaSnippet && (
                            <p style={{ margin: "2px 0 0 0", color: "#0f766e" }}>
                              🧩 Pauta DUA: <em>"{duaSnippet}"</em>
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Acciones Rápidas */}
                    <div style={{ display: "flex", gap: "6px", flexShrink: 0, alignItems: "center" }}>
                      <button
                        type="button"
                        onClick={(e) => handleExportarWord(p, e)}
                        title="Exportar plan a Word (.docx)"
                        style={{
                          background: "#f8fafc",
                          border: "1px solid #cbd5e1",
                          borderRadius: "6px",
                          padding: "6px 10px",
                          fontSize: "12px",
                          cursor: "pointer"
                        }}
                      >
                        📄
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSeleccionarPlan(p)}
                        style={{
                          background: "#0d9488",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          padding: "6px 12px",
                          fontSize: "12px",
                          fontWeight: "600",
                          cursor: "pointer"
                        }}
                      >
                        Revisar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </>
    ) : (
      /* Vista de Analítica y Cobertura Curricular Institucional */
      <div style={{ flex: 1, overflowY: "auto", paddingRight: "4px", marginTop: "12px" }}>
        {/* 1. Tarjetas de Indicadores Estratégicos (KPIs) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px", marginBottom: "16px" }}>
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px", padding: "12px", textAlign: "center" }}>
            <span style={{ display: "block", fontSize: "11px", color: "#166534", fontWeight: "600", textTransform: "uppercase" }}>Tasa de Aprobación</span>
            <strong style={{ fontSize: "22px", color: "#15803d" }}>{analitica.tasaAprobacion}%</strong>
            <span style={{ display: "block", fontSize: "11px", color: "#15803d", marginTop: "2px" }}>
              {analitica.conteoEstados.aprobadas} de {analitica.total} planes
            </span>
          </div>
          <div style={{ background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: "10px", padding: "12px", textAlign: "center" }}>
            <span style={{ display: "block", fontSize: "11px", color: "#0f766e", fontWeight: "600", textTransform: "uppercase" }}>Inclusión DUA / NEAE</span>
            <strong style={{ fontSize: "22px", color: "#0d9488" }}>{analitica.tasaDua}%</strong>
            <span style={{ display: "block", fontSize: "11px", color: "#0f766e", marginTop: "2px" }}>
              Adecuaciones curriculares
            </span>
          </div>
          <div style={{ background: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: "10px", padding: "12px", textAlign: "center" }}>
            <span style={{ display: "block", fontSize: "11px", color: "#6b21a8", fontWeight: "600", textTransform: "uppercase" }}>Con Observaciones</span>
            <strong style={{ fontSize: "22px", color: "#7e22ce" }}>{analitica.tasaObservadas}%</strong>
            <span style={{ display: "block", fontSize: "11px", color: "#7e22ce", marginTop: "2px" }}>
              {analitica.conteoEstados.observadas} planes con ajustes
            </span>
          </div>
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "10px", padding: "12px", textAlign: "center" }}>
            <span style={{ display: "block", fontSize: "11px", color: "#92400e", fontWeight: "600", textTransform: "uppercase" }}>Por Revisar</span>
            <strong style={{ fontSize: "22px", color: "#b45309" }}>{analitica.conteoEstados.pendientes}</strong>
            <span style={{ display: "block", fontSize: "11px", color: "#b45309", marginTop: "2px" }}>
              {analitica.tasaPendientes}% de carga escolar
            </span>
          </div>
        </div>

        {/* 2. Cobertura de las 7 Competencias Fundamentales MINERD */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px", marginBottom: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div>
              <h4 style={{ margin: 0, fontSize: "15px", color: "#0f766e" }}>
                🎯 Cobertura de las 7 Competencias Fundamentales
              </h4>
              <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#64748b" }}>
                Adecuación Curricular 2023 • Balance institucional de competencias trabajadas
              </p>
            </div>
            <span style={{ fontSize: "11px", background: "#f1f5f9", color: "#475569", padding: "3px 8px", borderRadius: "6px", fontWeight: "600" }}>
              MINERD 04-2023
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {analitica.coberturaCompetencias.map((comp) => {
              const colorBarra = comp.porcentaje >= 65 ? "#10b981" : comp.porcentaje >= 25 ? "#0284c7" : "#f59e0b";
              const bgBadge = comp.porcentaje >= 65 ? "#ecfdf5" : comp.porcentaje >= 25 ? "#f0f9ff" : "#fffbeb";
              const colorBadge = comp.porcentaje >= 65 ? "#065f46" : comp.porcentaje >= 25 ? "#0369a1" : "#92400e";
              return (
                <div key={comp.id} style={{ background: "#f8fafc", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <span style={{ fontSize: "13px", fontWeight: "600", color: "#1e293b" }}>
                      {comp.nombre}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "11px", color: "#64748b" }}>
                        {comp.conteo} de {analitica.total} ({comp.porcentaje}%)
                      </span>
                      <span style={{ fontSize: "11px", fontWeight: "700", background: bgBadge, color: colorBadge, padding: "2px 8px", borderRadius: "12px" }}>
                        {comp.nivelTrabajo}
                      </span>
                    </div>
                  </div>
                  <svg width="100%" height="8" style={{ display: "block", borderRadius: "4px", overflow: "hidden" }}>
                    <rect width="100%" height="8" fill="#e2e8f0" rx="4" />
                    <rect width={`${comp.porcentaje}%`} height="8" fill={colorBarra} rx="4" />
                  </svg>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Distribución Curricular: Áreas y Grados */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginBottom: "16px" }}>
          {/* Desglose por Área */}
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px" }}>
            <h4 style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#0f766e" }}>
              📚 Distribución por Área Curricular
            </h4>
            {analitica.distribucionAreas.length === 0 ? (
              <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>Sin datos registrados</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {analitica.distribucionAreas.map((item) => {
                  const pct = analitica.total > 0 ? Math.round((item.total / analitica.total) * 100) : 0;
                  return (
                    <div key={item.area} style={{ fontSize: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                        <span style={{ fontWeight: "600", color: "#334155" }}>{item.area}</span>
                        <span style={{ color: "#64748b" }}>{item.total} {item.total === 1 ? "plan" : "planes"} ({pct}%)</span>
                      </div>
                      <div style={{ display: "flex", height: "7px", borderRadius: "4px", overflow: "hidden", background: "#e2e8f0" }}>
                        {item.aprobadas > 0 && (
                          <div style={{ width: `${(item.aprobadas / item.total) * 100}%`, background: "#16a34a" }} title={`Aprobadas: ${item.aprobadas}`} />
                        )}
                        {item.observadas > 0 && (
                          <div style={{ width: `${(item.observadas / item.total) * 100}%`, background: "#9333ea" }} title={`Observadas: ${item.observadas}`} />
                        )}
                        {item.pendientes > 0 && (
                          <div style={{ width: `${(item.pendientes / item.total) * 100}%`, background: "#f59e0b" }} title={`Pendientes: ${item.pendientes}`} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Desglose por Grado Escolar */}
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px" }}>
            <h4 style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#0f766e" }}>
              🎓 Distribución por Grado Escolar
            </h4>
            {analitica.distribucionGrados.length === 0 ? (
              <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>Sin datos registrados</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {analitica.distribucionGrados.map((item) => {
                  const pct = analitica.total > 0 ? Math.round((item.total / analitica.total) * 100) : 0;
                  return (
                    <div key={item.grado} style={{ fontSize: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                        <span style={{ fontWeight: "600", color: "#334155" }}>{item.grado}</span>
                        <span style={{ color: "#64748b" }}>{item.total} {item.total === 1 ? "plan" : "planes"} ({pct}%)</span>
                      </div>
                      <div style={{ display: "flex", height: "7px", borderRadius: "4px", overflow: "hidden", background: "#e2e8f0" }}>
                        {item.aprobadas > 0 && (
                          <div style={{ width: `${(item.aprobadas / item.total) * 100}%`, background: "#16a34a" }} title={`Aprobadas: ${item.aprobadas}`} />
                        )}
                        {item.observadas > 0 && (
                          <div style={{ width: `${(item.observadas / item.total) * 100}%`, background: "#9333ea" }} title={`Observadas: ${item.observadas}`} />
                        )}
                        {item.pendientes > 0 && (
                          <div style={{ width: `${(item.pendientes / item.total) * 100}%`, background: "#f59e0b" }} title={`Pendientes: ${item.pendientes}`} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 4. Diagnóstico Pedagógico y Alertas Tempranas */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px", marginBottom: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div>
              <h4 style={{ margin: 0, fontSize: "15px", color: "#0f766e" }}>
                🚨 Diagnóstico Pedagógico y Alertas Tempranas
              </h4>
              <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#64748b" }}>
                Detección proactiva de brechas curriculares y recomendaciones institucionales
              </p>
            </div>
          </div>

          {analitica.alertasPedagogicas.map((alerta, idx) => {
            const borderColor = alerta.tipo === "exito" ? "#86efac" : alerta.tipo === "advertencia" ? "#fca5a5" : alerta.tipo === "atencion" ? "#fcd34d" : "#93c5fd";
            const bgColor = alerta.tipo === "exito" ? "#f0fdf4" : alerta.tipo === "advertencia" ? "#fef2f2" : alerta.tipo === "atencion" ? "#fffbeb" : "#eff6ff";
            return (
              <div key={idx} style={{ background: bgColor, border: `1px solid ${borderColor}`, borderRadius: "8px", padding: "12px", marginBottom: "10px" }}>
                <strong style={{ display: "block", fontSize: "13px", color: "#1e293b", marginBottom: "4px" }}>
                  {alerta.titulo}
                </strong>
                <p style={{ margin: "0 0 6px 0", fontSize: "12px", color: "#475569" }}>
                  {alerta.descripcion}
                </p>
                <div style={{ background: "rgba(255,255,255,0.7)", padding: "6px 10px", borderRadius: "6px", fontSize: "11px", color: "#334155" }}>
                  💡 <strong>Recomendación MINERD:</strong> {alerta.recomendacion}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    )}
      </div>
    </div>
  );
}
