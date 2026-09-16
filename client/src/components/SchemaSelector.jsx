import { useState } from "react";

export const ESQUEMAS = [
  {
    id: "inicial",
    nombre: "Tradicional (Inicial)",
    descripcion: "Planificación por centros de interés para niños de 0 a 6 años.",
    niveles: "Nivel Inicial",
    color: "#E8F5E9"
  },
  {
    id: "primario",
    nombre: "Tradicional (Primario)",
    descripcion: "Planificación por asignaturas para 1ro a 6to de Primaria.",
    niveles: "Nivel Primario",
    color: "#E3F2FD"
  },
  {
    id: "secundario",
    nombre: "Tradicional (Secundario)",
    descripcion: "Planificación especializada por asignaturas para Secundaria y Bachillerato.",
    niveles: "Nivel Secundario",
    color: "#FFF3E0"
  },
  {
    id: "especial",
    nombre: "Educación Especial",
    descripcion: "Planificación con adaptaciones curriculares para necesidades educativas especiales (NEE).",
    niveles: "Todos los niveles",
    color: "#FCE4EC"
  },
  {
    id: "conbase",
    nombre: "Programa 'Con Base'",
    descripcion: "Alfabetización inicial con los 4 momentos del programa MINERD.",
    niveles: "1ro, 2do y 3ro de Primaria",
    color: "#F3E5F5"
  },
  {
    id: "abp",
    nombre: "Aprendizaje Basado en Proyectos (ABP)",
    descripcion: "Planificación centrada en resolver un problema real mediante un producto.",
    niveles: "Primaria, Secundaria, Universidad",
    color: "#E0F7FA"
  },
  {
    id: "competencias_situacion",
    nombre: "Situación de Aprendizaje",
    descripcion: "Todo el contenido se ancla a un escenario o problema del contexto del estudiante.",
    niveles: "Secundaria, Universidad",
    color: "#FFFDE7"
  },
  {
    id: "secuencia_didactica",
    nombre: "Secuencia Didáctica",
    descripcion: "Planificación micro-curricular paso a paso para 1 a 3 sesiones de clase.",
    niveles: "Todos los niveles",
    color: "#E8EAF6"
  }
];

export const PERIODOS = [
  { value: "diaria", label: "Diaria" },
  { value: "semanal", label: "Semanal" },
  { value: "mensual", label: "Mensual" },
  { value: "anual", label: "Anual" },
  { value: "unidad de aprendizaje", label: "Unidad" },
  { value: "proyecto", label: "Proyecto" }
];

export default function SchemaSelector({ onSeleccionar, onCerrar, periodoActivo, nivelActivo }) {
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState(periodoActivo || "diaria");

  return (
    <div className="schema-overlay" onClick={onCerrar}>
      <div className="schema-panel" onClick={(e) => e.stopPropagation()}>
        
        {/* Header del panel */}
        <div className="schema-header">
          <h2>Esquemas de Planificación</h2>
          <button className="schema-close-btn" onClick={onCerrar}>✕</button>
        </div>

        {/* Selector de periodo */}
        <div className="schema-periodo-bar">
          {PERIODOS.map((p) => (
            <button
              key={p.value}
              className={`schema-periodo-chip ${periodoSeleccionado === p.value ? "active" : ""}`}
              onClick={() => setPeriodoSeleccionado(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Grid de tarjetas */}
        <div className="schema-grid">
          {ESQUEMAS.map((esq) => (
            <button
              key={esq.id}
              className={`schema-card ${nivelActivo === esq.id ? "selected" : ""}`}
              style={{ borderLeftColor: esq.color !== "#FFFFFF" ? esq.color : undefined }}
              onClick={() => {
                onSeleccionar(periodoSeleccionado, esq.id);
                onCerrar();
              }}
            >
              <div className="schema-card-nombre">{esq.nombre}</div>
              <div className="schema-card-desc">{esq.descripcion}</div>
              <div className="schema-card-nivel">{esq.niveles}</div>
              {nivelActivo === esq.id && <span className="schema-card-check">✓ Activo</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
