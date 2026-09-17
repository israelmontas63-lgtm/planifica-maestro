/**
 * esquemasData.js
 * Constantes estáticas de esquemas y periodos.
 * Extraídas para permitir que App.jsx no necesite cargar el componente pesado SchemaSelector en el arranque inicial.
 */

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
