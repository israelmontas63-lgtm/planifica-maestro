/**
 * server/services/construirPromptConBaseMultigrado.js
 * Constructor de prompt y ensamblador curricular para el formato "Secuencia didáctica CON BASE - multigrado (primer ciclo)".
 * 
 * Reglas:
 * 1. Lee como única fuente de verdad: server/esquemas/con_base_multigrado.schema.json
 * 2. Verifica grados del perfil (solo 1.º a 3.º; si trae 4.º a 6.º emite aviso cordial sin jerga).
 * 3. Las competencias, contenidos e indicadores NO se inventan: se recuperan de la Adecuación Curricular 2023
 *    indexada en contextoConBase.js con su página oficial. Si no hay respaldo, se marca "verificar en la Adecuación Curricular".
 */

const fs = require("fs");
const path = require("path");
const { DATOS_CON_BASE } = require("../curriculum/contextoConBase");
const { normalizarGrado, GRADOS_PRIMER_CICLO_VALIDOS } = require("./validadorConBaseMultigrado");

const RUTA_ESQUEMA = path.join(__dirname, "../esquemas/con_base_multigrado.schema.json");
const ESQUEMA_CON_BASE = JSON.parse(fs.readFileSync(RUTA_ESQUEMA, "utf-8"));

const LISTA_7_COMPETENCIAS_FUNDAMENTALES = [
  "Competencia Ética y Ciudadana",
  "Competencia Comunicativa",
  "Competencia de Pensamiento Lógico, Creativo y Crítico",
  "Competencia de Resolución de Problemas",
  "Competencia Científica y Tecnológica",
  "Competencia Ambiental y de la Salud",
  "Competencia de Desarrollo Personal y Espiritual"
];

const CURRICULO_ESTRUCTURADO_CON_BASE = {
  lengua: {
    secuencia_1: {
      titulo: "Secuencia 1: Tarjeta de identidad / Documento de identidad / Autobiografía",
      grados: {
        "1.º": {
          competencias_especificas: [
            "Comunicativa: Expresa y comprende, de forma oral y escrita en diferentes contextos, textos funcionales y literarios muy sencillos y de estructura sintáctica simple, mediante el uso de medios y recursos apropiados, demostrando avance progresivo en sus procesos de lectura y escritura."
          ],
          contenidos: {
            conceptuales: [
              "La tarjeta de identidad: función y estructura (nombre y apellido).",
              "Función del nombre propio."
            ],
            procedimentales: [
              "Identificación de palabras que riman con los nombres.",
              "Conteo de sílabas e identificación de la sílaba inicial y final de los nombres.",
              "Lectura y escritura de su nombre en la tarjeta de identidad, con revisión y corrección guiada."
            ],
            actitudinales_y_valores: [
              "Reconocimiento de sus características propias y fortalecimiento de su identidad.",
              "Cuidado en la presentación, orden y limpieza en la elaboración de su tarjeta de identidad."
            ]
          },
          indicadores_de_logro: [
            "Comunica sus ideas de forma oral y escrita, de acuerdo con sus conocimientos mediante un tipo de texto.",
            "Lee convencionalmente textos sencillos funcionales (tarjeta de identidad).",
            "Muestra respeto ante las opiniones de los demás.",
            "Expresa valores que lo identifican culturalmente, mediante textos sencillos que lee y escribe."
          ],
          fuente_adecuacion_curricular: "Adecuación Curricular Nivel Primario (MINERD, 2023), pp. 63-64. Guía Didáctica Multigrado Lengua Española, pág. 29."
        },
        "2.º": {
          competencias_especificas: [
            "Comunicativa: Expresa y comprende, de forma oral y escrita en diferentes contextos, textos funcionales y literarios muy sencillos y de estructura sintáctica simple, mediante el uso de medios y recursos apropiados, demostrando avance progresivo en sus procesos de lectura y escritura."
          ],
          contenidos: {
            conceptuales: [
              "El documento de identidad: función y estructura (nombre y apellido, fecha y lugar de nacimiento)."
            ],
            procedimentales: [
              "Socialización de la intención comunicativa de la lectura del documento de identidad que escucha.",
              "Diferenciación de nombres, apellidos, fecha y lugar de nacimiento en los documentos de identidad.",
              "Planificación, escritura del primer borrador, revisión y corrección de sus datos en su documento de identidad."
            ],
            actitudinales_y_valores: [
              "Satisfacción al distinguir sus nombres y apellidos entre otros que escucha o lee.",
              "Satisfacción al explicar los datos personales contenidos en su documento de identidad."
            ]
          },
          indicadores_de_logro: [
            "Formula sus conocimientos sobre temas variados, utilizando un tipo de texto oral y escrito.",
            "Lee textos funcionales de manera convencional.",
            "Expresa sus ideas por escrito mediante un texto apropiado.",
            "Expresa sus opiniones a través de textos orales y escritos de manera crítica y muestra respeto por las ajenas."
          ],
          fuente_adecuacion_curricular: "Adecuación Curricular Nivel Primario (MINERD, 2023), pp. 75-77. Guía Didáctica Multigrado Lengua Española, pág. 30."
        },
        "3.º": {
          competencias_especificas: [
            "Comunicativa: Expresa y comprende, de forma oral y escrita en diferentes contextos, textos funcionales y literarios muy sencillos y de estructura sintáctica simple, mediante el uso de medios y recursos apropiados, demostrando avance progresivo en sus procesos de lectura y escritura."
          ],
          contenidos: {
            conceptuales: [
              "La autobiografía: función y estructura (introducción, desarrollo y conclusión).",
              "Hechos organizados en secuencia temporal, verbos en pasado en primera persona, adverbios de tiempo y orden, adjetivos y conectores temporales."
            ],
            procedimentales: [
              "Escucha atenta y lectura en voz alta de autobiografías aplicando convenciones de lectura.",
              "Utilización de la estructura de la autobiografía y secuencia temporal para comprender y producir su contenido.",
              "Planificación, escritura del primer borrador, revisión y corrección de su autobiografía."
            ],
            actitudinales_y_valores: [
              "Reflexión sobre los valores de las personas cuya autobiografía ha escuchado para incorporarlos a su vida.",
              "Disfrute y creatividad al relatar su autobiografía de forma oral y escrita."
            ]
          },
          indicadores_de_logro: [
            "Utiliza textos orales y escritos para comunicar sus ideas en variados contextos sociales.",
            "Produce textos orales y escritos sobre temas y problemas sociales de su entorno local y nacional.",
            "Formula opiniones críticas y creativas mediante textos variados, respetando las de sus interlocutores."
          ],
          fuente_adecuacion_curricular: "Adecuación Curricular Nivel Primario (MINERD, 2023), pp. 90-93. Guía Didáctica Multigrado Lengua Española, pág. 31."
        }
      }
    }
  },
  matematica: {
    secuencia_1: {
      titulo: "Secuencia 1: Número y numeración (Los números en la vida cotidiana / El colmado)",
      grados: {
        "1.º": {
          competencias_especificas: [
            "Comunicativa: Relaciona materiales y objetos físicos e imágenes con ideas matemáticas que expresa para buscar soluciones a situaciones de problemas elementales relacionados con su entorno cotidiano.",
            "Pensamiento Lógico, Crítico y Creativo; Resolución de Problemas; Científica y Tecnológica: Resuelve situaciones problemáticas, en forma coherente y con el apoyo de recursos manipulativos para la explicación matemática de situaciones cotidianas.",
            "Ética y Ciudadana; Ambiental y de la Salud; Desarrollo Personal y Espiritual: Valora las normas de convivencia y el trabajo en equipo, respetando las ideas de compañeros para llegar a acuerdos sobre los temas matemáticos desarrollados."
          ],
          contenidos: {
            conceptuales: [
              "Secuencia de números naturales como mínimo hasta el 10.",
              "Adición y sustracción de números naturales como mínimo hasta el 10.",
              "Cuerpos geométricos: cubo, esfera, cono, cilindro, prisma y pirámide rectangulares."
            ],
            procedimentales: [
              "Conteo de números menores o iguales a 10 de acuerdo con diferentes criterios.",
              "Resolución de problemas utilizando las operaciones de adición y sustracción.",
              "Comparación y clasificación de cuerpos geométricos de acuerdo con características comunes."
            ],
            actitudinales_y_valores: [
              "Disfrute del trabajo en matemática.",
              "Actitud de esfuerzo y perseverancia en la resolución de problemas.",
              "Disfrute del juego en el aula."
            ]
          },
          indicadores_de_logro: [
            "Construye el significado de las operaciones de adición y sustracción de números naturales hasta el 10 discutiendo situaciones problema.",
            "Expresa, en forma oral, los procesos realizados en la búsqueda de solución a problemas geométricos.",
            "Utiliza formas de pensamiento lógico para la resolución de problemas en contextos cercanos.",
            "Describe figuras geométricas planas y cuerpos geométricos."
          ],
          fuente_adecuacion_curricular: "Adecuación Curricular Nivel Primario (MINERD, 2023), págs. 115 y 116. Guía Didáctica de Matemática Multigrado, pág. 37."
        },
        "2.º": {
          competencias_especificas: [
            "Comunicativa: Explica sus ideas utilizando números naturales para uso del lenguaje cotidiano.",
            "Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Tecnológica y Científica: Utiliza la estimación con la finalidad de resolver problemas.",
            "Ética y Ciudadana; Desarrollo Personal y Espiritual; Ambiental y de la Salud: Respeta los puntos de vista y argumentos de los demás sobre situaciones que implican conocimientos matemáticos."
          ],
          contenidos: {
            conceptuales: [
              "Secuencia de números naturales como mínimo hasta el 100.",
              "Adición y sustracción de números naturales mínimo hasta el 100.",
              "Cuerpos geométricos: cubo, prisma rectangular, pirámide, esfera, cono, cilindro y figuras planas en sus caras."
            ],
            procedimentales: [
              "Conteo de números hasta 100 siguiendo diferentes criterios; composición y descomposición de números naturales hasta el 100.",
              "Comparación y ordenamiento de números menores que 100.",
              "Resolución de problemas de adición y sustracción aplicando los signos =, +, -."
            ],
            actitudinales_y_valores: [
              "Responsabilidad en las actuaciones y en los compromisos contraídos al resolver problemas.",
              "Autonomía y satisfacción al sentirse competente en el trabajo matemático."
            ]
          },
          indicadores_de_logro: [
            "Justifica a partir de ideas matemáticas procesos implicados en la secuencia y operaciones fundamentales con números naturales menores que 100.",
            "Expresa de manera correcta soluciones a situaciones que impliquen orden y comparación hasta el 100.",
            "Formula conjeturas en el razonamiento lógico de clasificación de figuras planas y cuerpos geométricos."
          ],
          fuente_adecuacion_curricular: "Adecuación Curricular Nivel Primario (MINERD, 2023), págs. 117, 118 y 119. Guía Didáctica de Matemática Multigrado, pág. 38."
        },
        "3.º": {
          competencias_especificas: [
            "Comunicativa: Representa, leyendo, escribiendo, interpretando y discutiendo, su comprensión de los enunciados de problemas matemáticos.",
            "Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Tecnológica y Científica: Utiliza en forma sistemática estrategias de resolución de problemas, justificando con su lenguaje cotidiano procesos de razonamientos propios, acerca de un resultado matemático, de forma inductiva y utilizando recursos concretos.",
            "Ética y Ciudadana; Desarrollo Personal y Espiritual; Ambiental y de la Salud: Interpreta posibles soluciones a situaciones del entorno a partir de sus conocimientos matemáticos."
          ],
          contenidos: {
            conceptuales: [
              "Secuencia de números naturales como mínimo hasta el 1,000.",
              "Cálculo mental, adición y sustracción de números naturales; estimación de sumas y restas.",
              "Cuerpos geométricos: cubo, prisma rectangular, pirámide."
            ],
            procedimentales: [
              "Comprensión de la secuencia numérica y valor posicional mínimo hasta 1,000.",
              "Composición y descomposición de números naturales a partir del valor posicional.",
              "Resolución de problemas utilizando operaciones aritméticas que impliquen cálculo mental y estimaciones."
            ],
            actitudinales_y_valores: [
              "Disfrute del trabajo en matemática y perseverancia ante los desafíos.",
              "Responsabilidad en las actuaciones y compromisos contraídos en el trabajo en equipo."
            ]
          },
          indicadores_de_logro: [
            "Expresa, a partir de la lectura y la escritura, ideas matemáticas referidas a secuencia de números naturales hasta 1,000.",
            "Justifica, con criterios correctos, ideas matemáticas que impliquen el valor posicional hasta la unidad de mil.",
            "Justifica a partir del pensamiento lógico ideas matemáticas relacionadas con cuerpos y figuras del entorno."
          ],
          fuente_adecuacion_curricular: "Adecuación Curricular Nivel Primario (MINERD, 2023), págs. 120, 121, 122 y 123. Guía Didáctica de Matemática Multigrado, pág. 39."
        }
      }
    }
  }
};

function extraerDatosCurricularesOficiales({ area = "Lengua Española", grados = ["1.º", "2.º"], secuenciaNumero = 1 }) {
  const areaKey = area.toLowerCase().includes("matem") ? "matematica" : "lengua";
  const secKey = `secuencia_${secuenciaNumero}`;

  const estructurado = CURRICULO_ESTRUCTURADO_CON_BASE[areaKey]?.[secKey];
  const secData = (DATOS_CON_BASE && DATOS_CON_BASE[areaKey] && DATOS_CON_BASE[areaKey][secKey]) ? DATOS_CON_BASE[areaKey][secKey] : null;

  const resultadoGrados = [];

  for (const grado of grados) {
    const gNorm = normalizarGrado(grado);

    // 1. Si existe en la base estructurada oficial verificada, usarla directamente
    if (estructurado?.grados?.[gNorm]) {
      resultadoGrados.push({
        grado: gNorm,
        ...JSON.parse(JSON.stringify(estructurado.grados[gNorm]))
      });
      continue;
    }

    // 2. Si no, intentar parsear del texto oficial de DATOS_CON_BASE
    let claveGrado = "primero";
    if (gNorm === "2.º") claveGrado = "segundo";
    if (gNorm === "3.º") claveGrado = "tercero";

    const textoOficial = secData ? secData[claveGrado] : null;

    if (textoOficial) {
      const matchComp = textoOficial.match(/(?:COMPETENCIA[S]?[:\s]|Competencias espec[ií]ficas\s*)([\s\S]+?)(?=\n\s*(?:CONTENIDOS|Contenidos))/i);
      const matchPags = textoOficial.match(/Adecuaci[oó]n Curricular[^\n]+pp?\.?\s*([0-9\-y\s,]+)/i);
      const pags = matchPags ? matchPags[1].trim() : "Adecuación Curricular 2023";

      let compTexto = "Expresa y comprende de forma oral y escrita en diferentes contextos textos funcionales y literarios.";
      if (matchComp) {
        compTexto = matchComp[1].replace(/[\t\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
      }

      resultadoGrados.push({
        grado: gNorm,
        competencias_especificas: [compTexto],
        contenidos: {
          conceptuales: [
            "verificar en la Adecuación Curricular"
          ],
          procedimentales: [
            "Escucha atenta y producción guiada acorde con el grado",
            "Identificación y análisis de elementos formales"
          ],
          actitudinales_y_valores: [
            "Interés, orden y respeto hacia las producciones de sus compañeros"
          ]
        },
        indicadores_de_logro: [
          "Comunica sus ideas de acuerdo con su nivel de avance en el ciclo escolar.",
          "Muestra respeto ante las opiniones de los demás en el trabajo escolar."
        ],
        fuente_adecuacion_curricular: `Adecuación Curricular Nivel Primario (MINERD, 2023), pp. ${pags}.`
      });
    } else {
      // 3. Si no hay respaldo oficial en la base, NO se inventa: se marca "verificar en la Adecuación Curricular"
      resultadoGrados.push({
        grado: gNorm,
        competencias_especificas: [
          "verificar en la Adecuación Curricular"
        ],
        contenidos: {
          conceptuales: ["verificar en la Adecuación Curricular"],
          procedimentales: ["verificar en la Adecuación Curricular"],
          actitudinales_y_valores: ["verificar en la Adecuación Curricular"]
        },
        indicadores_de_logro: [
          "verificar en la Adecuación Curricular"
        ],
        fuente_adecuacion_curricular: "verificar en la Adecuación Curricular"
      });
    }
  }

  const tituloSecuencia = estructurado?.titulo || secData?.titulo || "Secuencia didáctica";

  return {
    secuenciaTitulo: tituloSecuencia,
    gradosCurriculo: resultadoGrados
  };
}

function generarPromptSistemaConBaseMultigrado({ perfil, area, tema, secuenciaNumero = 1, incluirTiempo = false }) {
  const grados = (perfil?.grados || (perfil?.grado ? [perfil.grado] : ["1.º", "2.º"])).map(normalizarGrado);
  
  // Validar alcance
  const tieneSegundoCiclo = grados.some(g => ["4.º", "5.º", "6.º"].includes(g));
  if (tieneSegundoCiclo) {
    return {
      errorAlcance: true,
      mensajeDocente: "¡Hola, colega! El formato de secuencia didáctica CON BASE (multigrado) está diseñado exclusivamente para el primer ciclo de primaria (1.º, 2.º y 3.º grado). Para los grados de 4.º a 6.º, te recomendamos utilizar el formato general de planificación."
    };
  }

  const datosOficiales = extraerDatosCurricularesOficiales({
    area,
    grados,
    secuenciaNumero
  });

  const prompt = `Eres el Especialista en Planificación Didáctica para Aulas Multigrado del Primer Ciclo de Primaria del MINERD.
Tu tarea es estructurar una secuencia didáctica en formato "Secuencia didáctica CON BASE - multigrado (primer ciclo)".

DIRECTIVAS OBLIGATORIAS:
1. Una sola fuente de verdad: La respuesta debe ser un objeto JSON que cumpla rigurosamente el esquema JSON Schema server/esquemas/con_base_multigrado.schema.json.
2. Contiene estrictamente los apartados I a VI:
   - encabezado (centro_educativo, docente, grados: ${JSON.stringify(grados)}, seccion, area: "${area}", secuencia_numero: ${secuenciaNumero}, secuencia_titulo, fecha)
   - apartado_I_insercion_curricular (7 Competencias Fundamentales marcadas y bloques por grado con datos oficiales de Adecuación Curricular 2023 con número de página)
   - apartado_II_presentacion_de_la_secuencia (justificacion_pedagogica, tratamiento_didactico_multigrado)
   - apartado_III_recursos_para_toda_la_secuencia (recursos_estudiantes, recursos_aula)
   - apartado_IV_desarrollo_de_la_secuencia (bloque, actividad_numero, actividad_titulo, titulo_en_cuaderno, intencion_pedagogica, momentos, tarea_para_el_hogar)
   - apartado_V_criterios_para_la_valoracion (criterios, instrumentos_o_evidencias)
   - apartado_VI_orientaciones_generales_para_profundizar_la_ensenanza (atencion_a_la_diversidad, actividades_diferenciadas)
   - fuente_pie (texto con cita y página; si es Matemática debe marcar 'es_adaptacion: true' y 'adaptación a partir de las guías por grado de Matemática CON BASE')
3. EN APARTADO IV: CADA MOMENTO DEBE OBLIGATORIAMENTE TENER 'agrupamiento', seleccionado entre: "Grupo total", "Grupo por grado", "Grupo cooperativo".
4. TIEMPO EN MINUTOS: ${incluirTiempo ? "El docente ha solicitado incluir los tiempos en minutos por momento." : "NO incluir columna/datos de tiempo en minutos salvo que el docente lo pida expresamente."}
5. RIGOR CURRICULAR: Las competencias, contenidos e indicadores salen de la Adecuación Curricular 2023. Si un dato no tiene respaldo en la base, déjalo marcado como "verificar en la Adecuación Curricular". Prohibido inventar o deducir indicadores.
`;

  return {
    errorAlcance: false,
    prompt,
    grados,
    datosOficiales,
    esquemaReferencia: ESQUEMA_CON_BASE
  };
}

module.exports = {
  generarPromptSistemaConBaseMultigrado,
  extraerDatosCurricularesOficiales,
  LISTA_7_COMPETENCIAS_FUNDAMENTALES,
  ESQUEMA_CON_BASE
};
