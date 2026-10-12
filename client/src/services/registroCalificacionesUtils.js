/**
 * client/src/services/registroCalificacionesUtils.js
 * Utilidades canónicas para el Registro de Calificaciones y Asistencia Oficial MINERD.
 * Conforme a la Ordenanza 04-2023 y la Adecuación Curricular 2023.
 */

// Lista de nombres de muestra realistas dominicanos para la nómina inicial
export const ESTUDIANTES_EJEMPLO_MINERD = [
  "Almonte Pérez, Carlos Manuel",
  "Batista Rosario, María Elena",
  "Cabral Encarnación, José Alberto",
  "De los Santos, Ana Patricia",
  "Estrella Gómez, David Alejandro",
  "Feliz Castillo, Sofía Isabel",
  "García Ventura, Juan Carlos",
  "Hernández Morillo, Laura Camila",
  "Inoa Ramírez, Pedro Luis",
  "Jiménez Valdez, Carmen Rosa",
  "López Tavárez, Manuel Antonio",
  "Martínez Peña, Katherine Pamela",
  "Núñez Guzmán, Ángel Gabriel",
  "Ortiz Cedeño, Daniela Marie",
  "Paredes Solano, Marcos Emilio",
  "Quezada Brito, Valentina",
  "Reyes Santana, Jonathan Josué",
  "Suárez De la Cruz, Gabriela",
  "Torres Meléndez, Luis Fernando",
  "Ureña Polanco, Ashley Nicole",
  "Vargas Gil, Sebastián",
  "Williams Cuevas, Diana Carolina",
  "Xavier Paulino, Emmanuel",
  "Ynoa Tejada, Camila Fernanda",
  "Zapata Mejia, Anthony José"
];

function normalizarTexto(txt) {
  return (txt || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "_")
    .trim();
}

/**
 * Busca de forma tolerante un valor dentro de un objeto
 */
function buscarEnObjeto(obj, claves) {
  if (!obj || typeof obj !== "object") return null;
  for (const c of claves) {
    if (obj[c] !== undefined && obj[c] !== null) return obj[c];
    const claveMin = c.toLowerCase();
    for (const k of Object.keys(obj)) {
      if (k.toLowerCase() === claveMin || k.toLowerCase().includes(claveMin)) {
        return obj[k];
      }
    }
  }
  return null;
}

/**
 * Extrae los Indicadores de Logro y Competencias Específicas del plan
 */
export function extraerIndicadoresRegistro(plan = {}) {
  const dp = plan?.datosPlanificacion || {};
  let indicadores = [];

  // 1. Intentar desde datosPlanificacion estructurado
  const indRaw = buscarEnObjeto(dp, [
    "indicadores_logro",
    "indicadores",
    "indicadoresDeLogro",
    "indicador_logro",
    "Indicadores de Logro",
    "criterios_evaluacion"
  ]);

  if (Array.isArray(indRaw) && indRaw.length > 0) {
    indicadores = indRaw.map((item, idx) => {
      const texto = typeof item === "string" ? item : item.texto || item.descripcion || item.indicador || `Indicador ${idx + 1}`;
      return {
        id: `ind_${idx + 1}`,
        codigo: `Ind. ${idx + 1}`,
        descripcion: texto.trim()
      };
    });
  } else if (typeof indRaw === "string" && indRaw.trim().length > 0) {
    indicadores = indRaw
      .split(/\n|\u2022|-/)
      .map((t) => t.trim())
      .filter((t) => t.length > 8)
      .slice(0, 5)
      .map((texto, idx) => ({
        id: `ind_${idx + 1}`,
        codigo: `Ind. ${idx + 1}`,
        descripcion: texto
      }));
  }

  // 2. Si no se hallaron indicadores, buscar competencias específicas
  if (indicadores.length === 0) {
    const compEspRaw = buscarEnObjeto(dp, [
      "competencias_especificas",
      "competenciasEspecificas",
      "competencia_especifica",
      "Competencias Específicas"
    ]);

    if (Array.isArray(compEspRaw) && compEspRaw.length > 0) {
      indicadores = compEspRaw.slice(0, 4).map((item, idx) => {
        const texto = typeof item === "string" ? item : item.texto || item.descripcion || `Competencia Específica ${idx + 1}`;
        return {
          id: `ind_${idx + 1}`,
          codigo: `C.E. ${idx + 1}`,
          descripcion: texto.trim()
        };
      });
    }
  }

  // 3. Respaldo canónico oficial según el área si aún está vacío
  if (indicadores.length === 0) {
    const tema = plan?.titulo || "el tema de la unidad";
    indicadores = [
      {
        id: "ind_1",
        codigo: "Ind. 1",
        descripcion: `Identifica y explica los conceptos fundamentales relacionados con ${tema}.`
      },
      {
        id: "ind_2",
        codigo: "Ind. 2",
        descripcion: `Aplica procedimientos y métodos prácticos en actividades de aprendizaje vinculadas al área.`
      },
      {
        id: "ind_3",
        codigo: "Ind. 3",
        descripcion: `Demuestra actitud colaborativa, interés reflexivo y cumplimiento de las normas de convivencia escolar.`
      }
    ];
  }

  return indicadores;
}

/**
 * Obtiene la clave de almacenamiento local de la nómina para un Grado y Sección
 */
export function obtenerClaveStorageNomina(grado = "", seccion = "A") {
  const gNorm = normalizarTexto(grado) || "general";
  const sNorm = normalizarTexto(seccion) || "a";
  return `pm_nomina_estudiantes_${gNorm}_${sNorm}`;
}

/**
 * Carga la nómina de estudiantes guardada o inicializa con la nómina estándar
 */
export function cargarNominaEstudiantes(grado = "", seccion = "A") {
  if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
    try {
      const clave = obtenerClaveStorageNomina(grado, seccion);
      const guardada = window.localStorage.getItem(clave);
      if (guardada) {
        const lista = JSON.parse(guardada);
        if (Array.isArray(lista) && lista.length > 0) {
          return lista;
        }
      }
    } catch (err) {
      console.warn("No se pudo cargar la nómina de localStorage, usando lista estándar:", err);
    }
  }

  // Nómina estándar de 25 estudiantes
  return ESTUDIANTES_EJEMPLO_MINERD.map((nombre, idx) => ({
    numero: idx + 1,
    nombre
  }));
}

/**
 * Guarda la nómina de estudiantes en localStorage
 */
export function guardarNominaEstudiantes(grado = "", seccion = "A", listaEstudiantes = []) {
  if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
    try {
      const clave = obtenerClaveStorageNomina(grado, seccion);
      window.localStorage.setItem(clave, JSON.stringify(listaEstudiantes));
      return true;
    } catch (err) {
      console.error("Error al guardar nómina de estudiantes:", err);
      return false;
    }
  }
  return false;
}

/**
 * Estructura los datos completos para la planilla de Calificaciones
 */
export function estructurarPlanillaCalificaciones(plan = {}, nomina = []) {
  const indicadores = extraerIndicadoresRegistro(plan);
  const listaEstudiantes = Array.isArray(nomina) && nomina.length > 0
    ? nomina
    : cargarNominaEstudiantes(plan?.grado, plan?.seccion || "A");

  // Calificaciones de muestra coherentes (escala Primaria L/P/I o Secundaria numérica)
  const esSecundaria = (plan?.grado || "").toLowerCase().includes("secundaria");

  const filas = listaEstudiantes.map((est, idx) => {
    const valoresIndicadores = {};
    indicadores.forEach((ind, indIdx) => {
      if (esSecundaria) {
        // Calificación numérica entre 70 y 98
        const nota = 75 + ((idx * 7 + indIdx * 11) % 24);
        valoresIndicadores[ind.id] = nota;
      } else {
        // Escala L, P, I con mayoría en Logrado
        const ciclo = (idx + indIdx) % 10;
        const valor = ciclo === 0 ? "I" : ciclo <= 2 ? "P" : "L";
        valoresIndicadores[ind.id] = valor;
      }
    });

    let calificacionFinal = "";
    let condicion = "Aprobado";

    if (esSecundaria) {
      const notas = Object.values(valoresIndicadores);
      const suma = notas.reduce((acc, v) => acc + (typeof v === "number" ? v : 0), 0);
      const prom = Math.round(suma / (notas.length || 1));
      calificacionFinal = prom;
      condicion = prom >= 70 ? "Aprobado" : "Recuperación";
    } else {
      const valores = Object.values(valoresIndicadores);
      const logrados = valores.filter((v) => v === "L").length;
      calificacionFinal = logrados >= Math.ceil(valores.length * 0.7) ? "L" : "P";
      condicion = calificacionFinal === "L" ? "Logrado" : "En Proceso";
    }

    return {
      numero: est.numero || idx + 1,
      nombre: est.nombre || `Estudiante ${idx + 1}`,
      valoresIndicadores,
      calificacionFinal,
      condicion,
      observacionesDua: idx % 5 === 0 ? "Tiempo extendido en evaluaciones" : ""
    };
  });

  return {
    indicadores,
    filas,
    totalEstudiantes: filas.length,
    esSecundaria
  };
}

/**
 * Estructura la matriz de Asistencia para 20 días lectivos (4 semanas)
 */
export function estructurarPlanillaAsistencia(nomina = [], diasTotal = 20) {
  const listaEstudiantes = Array.isArray(nomina) && nomina.length > 0
    ? nomina
    : ESTUDIANTES_EJEMPLO_MINERD.map((n, idx) => ({ numero: idx + 1, nombre: n }));

  // Generar etiquetas de días (Semana 1: Lun-Vie, etc.)
  const dias = [];
  const diasSemana = ["Lun", "Mar", "Mié", "Jue", "Vie"];
  for (let i = 1; i <= diasTotal; i++) {
    const diaNum = i;
    const diaSemana = diasSemana[(i - 1) % 5];
    const semNum = Math.floor((i - 1) / 5) + 1;
    dias.push({
      indice: i,
      etiqueta: `${diaSemana} ${diaNum}`,
      semana: `Semana ${semNum}`
    });
  }

  const filas = listaEstudiantes.map((est, idx) => {
    const registrosDias = {};
    let presentes = 0;
    let ausentes = 0;
    let excusas = 0;
    let tardanzas = 0;

    dias.forEach((d, dIdx) => {
      // Simulación de asistencia realista dominicana (>90% asistencia)
      const seed = (idx * 13 + dIdx * 7) % 30;
      let codigo = "P";
      if (seed === 0) codigo = "A";
      else if (seed === 1) codigo = "E";
      else if (seed === 2) codigo = "T";

      registrosDias[d.indice] = codigo;
      if (codigo === "P") presentes++;
      else if (codigo === "A") ausentes++;
      else if (codigo === "E") excusas++;
      else if (codigo === "T") tardanzas++;
    });

    const porcentajeAsistencia = Math.round(((presentes + excusas + tardanzas * 0.5) / diasTotal) * 100);
    const alertaDesercion = porcentajeAsistencia < 80;

    return {
      numero: est.numero || idx + 1,
      nombre: est.nombre || `Estudiante ${idx + 1}`,
      registrosDias,
      presentes,
      ausentes,
      excusas,
      tardanzas,
      porcentajeAsistencia,
      alertaDesercion
    };
  });

  return {
    dias,
    filas,
    totalDias: diasTotal,
    totalEstudiantes: filas.length
  };
}
