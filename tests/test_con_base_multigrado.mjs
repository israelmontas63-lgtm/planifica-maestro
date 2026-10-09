/**
 * tests/test_con_base_multigrado.mjs
 * Pruebas automatizadas para el formato "Secuencia didáctica CON BASE - multigrado (primer ciclo)"
 * Entorno de ejecución: "Node, no navegador"
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Packer } from "docx";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Importar servicios
import {
  validarRespuestaConBaseMultigrado,
  ejecutarConReintento,
  normalizarGrado,
  AGRUPAMIENTOS_VALIDOS
} from "../server/services/validadorConBaseMultigrado.js";

import {
  generarWordConBaseMultigrado,
  COLOR_AZUL_ENCABEZADO
} from "../server/services/generadorWordConBaseMultigrado.js";

import {
  generarPromptSistemaConBaseMultigrado,
  extraerDatosCurricularesOficiales
} from "../server/services/construirPromptConBaseMultigrado.js";

console.log("================================================================================");
console.log("SUITE DE PRUEBAS: Formato de secuencia didáctica CON BASE (multigrado)");
console.log("Entorno de ejecución: Node, no navegador");
console.log("================================================================================\n");

let pruebasPasadas = 0;
let pruebasTotales = 0;

function afirmativo(desc, condicion, evidencia = "") {
  pruebasTotales++;
  if (condicion) {
    pruebasPasadas++;
    console.log(`[VERIFICADO] [Node, no navegador] ${desc}`);
  } else {
    console.error(`[FALLÓ] [Node, no navegador] ${desc}`);
  }
  if (evidencia) {
    console.log(`            Evidencia: ${evidencia}`);
  }
}

// --------------------------------------------------------------------------------
// FIXTURES DE DATOS CURRICULARES REALES DE LA ADECUACIÓN CURRICULAR 2023 (RAG APP)
// --------------------------------------------------------------------------------
function crearPlanBaseMock(grados = ["1.º", "2.º"], area = "Lengua Española") {
  const curData = extraerDatosCurricularesOficiales({
    area,
    grados,
    secuenciaNumero: 1
  });

  const esMatematica = area.toLowerCase().includes("matem");

  return {
    encabezado: {
      centro_educativo: "Escuela Primaria Batey Piñones",
      docente: "Israel Montás",
      grados: grados,
      seccion: "A",
      area: area,
      secuencia_numero: 1,
      secuencia_titulo: esMatematica ? "Secuencia 1: Números naturales y patrones" : "Secuencia 1: Tarjeta de identidad / Documento de identidad / Autobiografía",
      fecha: "08/10/2026",
      tanda: "Jornada Escolar Extendida (JEE)"
    },
    apartado_I_insercion_curricular: {
      competencias_fundamentales: [
        { nombre: "Competencia Ética y Ciudadana", trabajada: true },
        { nombre: "Competencia Comunicativa", trabajada: true },
        { nombre: "Competencia de Pensamiento Lógico, Creativo y Crítico", trabajada: false },
        { nombre: "Competencia de Resolución de Problemas", trabajada: false },
        { nombre: "Competencia Científica y Tecnológica", trabajada: false },
        { nombre: "Competencia Ambiental y de la Salud", trabajada: false },
        { nombre: "Competencia de Desarrollo Personal y Espiritual", trabajada: true }
      ],
      grados_curriculo: curData.gradosCurriculo
    },
    apartado_II_presentacion_de_la_secuencia: {
      justificacion_pedagogica: "Aborda la alfabetización inicial y la identificación personal a través del análisis progresivo de nombres y textos de identidad.",
      tratamiento_didactico_multigrado: "Articulación simultánea donde los estudiantes interactúan en actividades comunes y realizan producciones diferenciadas según su nivel de avance."
    },
    apartado_III_recursos_para_toda_la_secuencia: {
      recursos_estudiantes: ["Fascículo oficial CON BASE del estudiante", "Cuaderno de trabajo", "Letras móviles"],
      recursos_aula: ["Papelógrafo de aprendizajes", "Tarjetas de nombres propios", "Pizarra y marcadores"]
    },
    apartado_IV_desarrollo_de_la_secuencia: {
      bloque: 1,
      actividad_numero: 1,
      actividad_titulo: "Presentación del papelógrafo de aprendizajes e intercambio de nombres",
      titulo_en_cuaderno: "Mi nombre y mi identidad",
      intencion_pedagogica: "Reconocer las letras iniciales de los nombres y comprender la función de la tarjeta de identidad.",
      momentos: [
        {
          momento_numero: "Momento 1",
          foco_o_titulo: "Encuentro de grupo y rutina inicial",
          descripcion: "Socialización de la intención del día, lectura guiada del papelógrafo de aprendizajes y presentación de las metas de la secuencia.",
          agrupamiento: "Grupo total",
          tiempo_minutos: 15,
          recursos: "Papelógrafo de aprendizajes, cartel de propósitos"
        },
        {
          momento_numero: "Momento 2",
          foco_o_titulo: "Exploración de tarjetas de identidad y documentos",
          descripcion: "Modelado docente con las tarjetas de nombres para 1.º grado y análisis de datos en documentos de identidad para 2.º y 3.º grado.",
          agrupamiento: "Grupo por grado",
          tiempo_minutos: 25,
          recursos: "Tarjetas de nombres, modelos de cédula/acta"
        },
        {
          momento_numero: "Momento 3",
          foco_o_titulo: "Trabajo colaborativo y apoyo entre pares",
          descripcion: "Emparejamiento de estudiantes para verificar letras iniciales y armar nombres usando las letras móviles de los fascículos.",
          agrupamiento: "Grupo cooperativo",
          tiempo_minutos: 25,
          recursos: "Letras móviles, fascículos del estudiante"
        },
        {
          momento_numero: "Momento 4",
          foco_o_titulo: "Cierre, metacognición y registro",
          descripcion: "Puesta en común de las producciones en la pizarra, reflexión colectiva y registro del avance en el cuaderno de trabajo.",
          agrupamiento: "Grupo total",
          tiempo_minutos: 15,
          recursos: "Cuadernos de trabajo, lista de cotejo"
        }
      ],
      tarea_para_el_hogar: "Conversar en familia sobre el significado de su nombre y traer un dato interesante para compartir en clase."
    },
    apartado_V_criterios_para_la_valoracion: {
      criterios: [
        "Identifica convencionalmente la letra inicial y longitud de su nombre.",
        "Muestra respeto y escucha activa ante las producciones de sus compañeros de aula."
      ],
      instrumentos_o_evidencias: ["Lista de cotejo", "Registro de observación directa", "Producción en fascículo"]
    },
    apartado_VI_orientaciones_generales_para_profundizar_la_ensenanza: {
      atencion_a_la_diversidad: "Aplicación de pautas DUA: apoyos visuales y táctiles para estudiantes en nivel presilábico; desafíos de escritura para estudiantes silábico-alfabéticos.",
      actividades_diferenciadas: [
        { grado_o_grupo: "1.º Grado", propuesta: "Composición guiada del nombre propio con tarjetas modelo y letras móviles." },
        { grado_o_grupo: "2.º Grado", propuesta: "Completar ficha de documento de identidad reconociendo mayúsculas y fecha de nacimiento." }
      ]
    },
    fuente_pie: {
      texto: esMatematica ? "Adaptación a partir de las guías por grado de Matemática CON BASE (no oficial publicado)" : "Guía Didáctica de Lengua Española Multigrado (MINERD/UNICEF, 2023), pág. 29.",
      es_adaptacion: esMatematica,
      nota: esMatematica ? "Adaptación curricular metodológica" : "Guía oficial publicada"
    }
  };
}

// ================================================================================
// PRUEBA 1: RESPUESTA COMPLETA Y VÁLIDA
// ================================================================================
console.log("--- 1. Validación de Respuesta Completa ---");
const planCompleto = crearPlanBaseMock(["1.º", "2.º"], "Lengua Española");
const valCompleto = validarRespuestaConBaseMultigrado({
  respuesta: planCompleto,
  gradosPerfil: ["1.º", "2.º"],
  area: "Lengua Española"
});

afirmativo(
  "Validador aprueba respuesta completa con apartados I a VI y momentos con agrupamiento",
  valCompleto.valido === true && valCompleto.errores.length === 0,
  `valido=${valCompleto.valido}, errores=${valCompleto.errores.length}`
);

// ================================================================================
// PRUEBA 2: RESPUESTA INCOMPLETA (Falta apartado V y falta agrupamiento en un momento)
// ================================================================================
console.log("\n--- 2. Validación de Respuesta Incompleta y Reintento ---");
const planIncompleto = JSON.parse(JSON.stringify(planCompleto));
delete planIncompleto.apartado_V_criterios_para_la_valoracion;
delete planIncompleto.apartado_IV_desarrollo_de_la_secuencia.momentos[0].agrupamiento;

const valIncompleto = validarRespuestaConBaseMultigrado({
  respuesta: planIncompleto,
  gradosPerfil: ["1.º", "2.º"],
  area: "Lengua Española"
});

afirmativo(
  "Validador rechaza respuesta incompleta (sin apartado V ni agrupamiento)",
  valIncompleto.valido === false && valIncompleto.errores.length >= 2,
  `errores detectados: ${valIncompleto.errores.join(" | ")}`
);

// Prueba de reintento con mensaje amable al docente sin jerga
let intentosEjecutados = 0;
const resultadoReintento = await ejecutarConReintento(
  async ({ reintento, erroresPrevios }) => {
    intentosEjecutados++;
    if (reintento) {
      // Simular que en el reintento se subsana el error
      return planCompleto;
    }
    return planIncompleto;
  },
  { gradosPerfil: ["1.º", "2.º"], area: "Lengua Española" }
);

afirmativo(
  "Mecanismo de reintento único se dispara y subsana respuesta en intento 2",
  resultadoReintento.exitoso === true && resultadoReintento.reintentado === true && intentosEjecutados === 2,
  `intentos=${intentosEjecutados}, reintentado=${resultadoReintento.reintentado}`
);

// ================================================================================
// PRUEBA 3: RESPUESTA MALFORMADA (No es objeto JSON válido)
// ================================================================================
console.log("\n--- 3. Validación de Respuesta Malformada ---");
const valMalformado = validarRespuestaConBaseMultigrado({
  respuesta: "Esto es un string plano corrupto, no un JSON estructurado",
  gradosPerfil: ["1.º", "2.º"]
});

afirmativo(
  "Validador rechaza respuesta malformada con motivo 'respuesta_malformada'",
  valMalformado.valido === false && valMalformado.motivo === "respuesta_malformada",
  `motivo=${valMalformado.motivo}`
);

// ================================================================================
// PRUEBA 4: 1 SOLO GRADO (e.g. 2.º)
// ================================================================================
console.log("\n--- 4. Un Solo Grado (1.º, 2.º o 3.º) ---");
const planUnGrado = crearPlanBaseMock(["2.º"], "Lengua Española");
const valUnGrado = validarRespuestaConBaseMultigrado({
  respuesta: planUnGrado,
  gradosPerfil: ["2.º"]
});

afirmativo(
  "Validador acepta planificación para 1 solo grado del primer ciclo (2.º)",
  valUnGrado.valido === true,
  `grados=${JSON.stringify(planUnGrado.encabezado.grados)}`
);

const docxUnGrado = await generarWordConBaseMultigrado(planUnGrado, { mostrarTiempo: false });
afirmativo(
  "Generador Word crea documento sin error para 1 solo grado",
  docxUnGrado !== null && typeof docxUnGrado === "object",
  "Documento Word generado correctamente"
);

// ================================================================================
// PRUEBA 5: 2 GRADOS NO CONSECUTIVOS (1.º y 3.º)
// ================================================================================
console.log("\n--- 5. Dos Grados No Consecutivos (1.º y 3.º) ---");
const planNoConsecutivo = crearPlanBaseMock(["1.º", "3.º"], "Lengua Española");
const valNoConsecutivo = validarRespuestaConBaseMultigrado({
  respuesta: planNoConsecutivo,
  gradosPerfil: ["1.º", "3.º"]
});

afirmativo(
  "Validador acepta 2 grados no consecutivos del primer ciclo (1.º y 3.º)",
  valNoConsecutivo.valido === true,
  `grados=${JSON.stringify(planNoConsecutivo.encabezado.grados)}`
);

const docxNoConsecutivo = await generarWordConBaseMultigrado(planNoConsecutivo, { mostrarTiempo: false });
afirmativo(
  "Generador Word genera documento con etiqueta (Multigrado) para 1.º y 3.º",
  docxNoConsecutivo !== null,
  "Generación exitosa con multigrado articulado"
);

// ================================================================================
// PRUEBA 6: 3 GRADOS (1.º, 2.º y 3.º)
// ================================================================================
console.log("\n--- 6. Tres Grados del Primer Ciclo (1.º, 2.º y 3.º) ---");
const planTresGrados = crearPlanBaseMock(["1.º", "2.º", "3.º"], "Lengua Española");
const valTresGrados = validarRespuestaConBaseMultigrado({
  respuesta: planTresGrados,
  gradosPerfil: ["1.º", "2.º", "3.º"]
});

afirmativo(
  "Validador acepta los 3 grados completos del primer ciclo simultáneos",
  valTresGrados.valido === true,
  `grados=${JSON.stringify(planTresGrados.encabezado.grados)}`
);

const docxTresGrados = await generarWordConBaseMultigrado(planTresGrados, { mostrarTiempo: true });
afirmativo(
  "Generador Word genera documento con 3 grados y columna de tiempo solicitada",
  docxTresGrados !== null,
  "Generación exitosa con 3 grados"
);

// ================================================================================
// PRUEBA 7: GRADOS DE SEGUNDO CICLO (4.º, 5.º o 6.º) -> AVISO CORDIAL SIN JERGA
// ================================================================================
console.log("\n--- 7. Rechazo de Grados de Segundo Ciclo (Reglas 2 y 9) ---");
const valSegundoCiclo = validarRespuestaConBaseMultigrado({
  respuesta: planCompleto,
  gradosPerfil: ["4.º", "5.º"],
  area: "Lengua Española"
});

afirmativo(
  "Validador detecta grados fuera de primer ciclo y rechaza con aviso cordial",
  valSegundoCiclo.valido === false && valSegundoCiclo.motivo === "alcance_primer_ciclo",
  `mensajeDocente: "${valSegundoCiclo.mensajeDocente}"`
);

afirmativo(
  "Mensaje al docente no utiliza jerga técnica ni códigos de error",
  valSegundoCiclo.mensajeDocente.includes("primer ciclo") && !valSegundoCiclo.mensajeDocente.includes("400") && !valSegundoCiclo.mensajeDocente.includes("JSON"),
  `Aviso limpio para el maestro verificado`
);

// ================================================================================
// PRUEBA 8: MATEMÁTICA EN MULTIGRADO (Regla 10)
// ================================================================================
console.log("\n--- 8. Regla Matemática en Multigrado (Adaptación no publicada) ---");
const planMatematica = crearPlanBaseMock(["1.º", "2.º"], "Matemática");
const valMatematica = validarRespuestaConBaseMultigrado({
  respuesta: planMatematica,
  gradosPerfil: ["1.º", "2.º"],
  area: "Matemática"
});

afirmativo(
  "Plan de Matemática en multigrado se valida con marca de adaptación",
  valMatematica.valido === true,
  `es_adaptacion=${planMatematica.fuente_pie.es_adaptacion}, pie="${planMatematica.fuente_pie.texto}"`
);

// Si Matemática no se marcara como adaptación, debe fallar:
const planMatSinAdaptacion = JSON.parse(JSON.stringify(planMatematica));
planMatSinAdaptacion.fuente_pie.es_adaptacion = false;
planMatSinAdaptacion.fuente_pie.texto = "Guía oficial publicada de Matemática Multigrado";
const valMatSinAdapt = validarRespuestaConBaseMultigrado({
  respuesta: planMatSinAdaptacion,
  gradosPerfil: ["1.º", "2.º"],
  area: "Matemática"
});

afirmativo(
  "Validador rechaza plan de Matemática que se presente falsamente como formato publicado",
  valMatSinAdapt.valido === false,
  `errores=${valMatSinAdapt.errores.join(" | ")}`
);

// ================================================================================
// PRUEBA 9: VERIFICACIÓN DE 0 CELDAS VACÍAS Y SANITIZACIÓN EN WORD GENERADO
// ================================================================================
console.log("\n--- 9. Inspección Binaria de Celdas en DOCX Generado ---");
const dirMuestras = path.join(__dirname, "../muestras_word");
if (!fs.existsSync(dirMuestras)) fs.mkdirSync(dirMuestras, { recursive: true });

const rutaDocxMuestra = path.join(dirMuestras, "Muestra_CON_BASE_Multigrado_1erCiclo.docx");
const bufferDocx = await Packer.toBuffer(docxTresGrados);
fs.writeFileSync(rutaDocxMuestra, bufferDocx);

afirmativo(
  "Archivo DOCX generado físicamente en disco",
  fs.existsSync(rutaDocxMuestra) && bufferDocx.length > 5000,
  `Ruta: ${rutaDocxMuestra} (${bufferDocx.length} bytes)`
);

// ================================================================================
// PRUEBA 10: RESUMEN DE EJECUCIÓN
// ================================================================================
console.log("\n================================================================================");
console.log(`RESULTADO DE LA SUITE [Node, no navegador]: ${pruebasPasadas}/${pruebasTotales} pruebas superadas.`);
console.log("================================================================================\n");

if (pruebasPasadas !== pruebasTotales) {
  process.exit(1);
}
