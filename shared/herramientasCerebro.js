/**
 * shared/herramientasCerebro.js
 * 
 * HERRAMIENTAS OFICIALES DEL CEREBRO DE PLANIFICA MAESTRO
 * 
 * Define las herramientas (Tools / Function Calling) con las que el asistente de IA
 * puede interactuar con el entorno pedagógico, la cámara, el editor de imágenes y el currículo MINERD.
 */

import { evaluarPoliticaDignidad } from "./politicaDignidadImagen.js";
import { obtenerOperacionPorId } from "./catalogoEdicionImagen.js";
import { verificarToxicidadEspecie, vincularCurriculoMINERD } from "./adaptadorPlantas.js";

export const HERRAMIENTAS_CEREBRO = [
  {
    name: "editar_imagen",
    description: "Aplica una operación pedagógica de edición o realce visual a una imagen escolar (pizarra, tarea, collage, adorno patrio). Cumple estrictamente la Política de Dignidad.",
    parameters: {
      type: "object",
      properties: {
        operacionId: {
          type: "string",
          description: "ID de la operación dentro del catálogo oficial de 480 operaciones (ej. 'luz_brillo_mas', 'nitidez_contraste_pizarra')."
        },
        instruccion: {
          type: "string",
          description: "Instrucción descriptiva en lenguaje natural del cambio pedagógico a realizar."
        },
        parametros: {
          type: "object",
          description: "Parámetros numéricos o de configuración (ej. factor, contraste, umbral)."
        },
        confirmadoPorUsuario: {
          type: "boolean",
          description: "Bandera de confirmación explícita si la operación afecta rasgos faciales en dramatizaciones."
        }
      },
      required: ["operacionId"]
    }
  },
  {
    name: "ojo_visor",
    description: "Activa o consulta el Ojo Visor de cámara en vivo para analizar objetos didácticos, flora, fauna o recursos del aula dominicana.",
    parameters: {
      type: "object",
      properties: {
        modo: {
          type: "string",
          enum: ["foto_puntual", "mirando_en_vivo"],
          description: "Modo de captura: 'foto_puntual' para captura fija o 'mirando_en_vivo' para rastreo de cambios de escena."
        },
        preguntaCurricular: {
          type: "string",
          description: "Pregunta o intención del docente (ej. '¿Qué tema de 4to de Primaria puedo enseñar con esto?')."
        },
        zoom: {
          type: "number",
          description: "Nivel de aumento digital deseado (entre 1.0 y 3.0)."
        }
      },
      required: ["modo"]
    }
  },
  {
    name: "identificar_especie_seguridad",
    description: "Identifica plantas, hongos o fauna del patio escolar, evalúa su nivel de toxicidad/riesgo para salvaguarda infantil y la vincula con el Currículo de Ciencias de la Naturaleza del MINERD.",
    parameters: {
      type: "object",
      properties: {
        nombreEspecie: {
          type: "string",
          description: "Nombre común o científico de la especie a evaluar (ej. 'Camila', 'Guao', 'Caoba')."
        },
        descripcion: {
          type: "string",
          description: "Detalles del hallazgo o contexto donde fue vista en el centro escolar."
        },
        nivelEscolar: {
          type: "string",
          description: "Nivel educativo (Inicial, Primaria, Secundaria)."
        }
      },
      required: ["nombreEspecie"]
    }
  },
  {
    name: "consultar_base_datos",
    description: "Consulta fragmentos curriculares oficiales del MINERD en la base de datos institucional. Usar obligatoriamente ante dudas sobre competencias, contenidos o indicadores oficiales.",
    parameters: {
      type: "object",
      properties: {
        nivel: {
          type: "string",
          description: "Nivel educativo (Inicial, Primario, Secundario)"
        },
        grado: {
          type: "string",
          description: "Grado escolar (ej. 1ro, 2do, 3ro, 4to, 5to, 6to)"
        },
        area: {
          type: "string",
          description: "Área curricular oficial (ej. Matemática, Lengua Española)"
        },
        tema_o_concepto: {
          type: "string",
          description: "Tema, concepto o contenido curricular a articular"
        }
      },
      required: ["nivel", "grado", "area", "tema_o_concepto"]
    }
  },
  {
    name: "exportar_plan_word",
    description: "Empaqueta la planificación docente con formato oficial MINERD / CON BASE (17 filas) incorporando ilustraciones pedagógicas editadas.",
    parameters: {
      type: "object",
      properties: {
        titulo: {
          type: "string",
          description: "Título del documento Word."
        },
        incluirIlustracion: {
          type: "boolean",
          description: "Indica si debe adjuntarse la imagen editada como recurso didáctico en el archivo .docx."
        }
      },
      required: ["titulo"]
    }
  }
];

/**
 * Obtiene las declaraciones de herramientas formateadas para la API de Gemini / Function Calling.
 */
export function obtenerHerramientasCerebro() {
  return HERRAMIENTAS_CEREBRO.map((h) => ({
    name: h.name,
    description: h.description,
    parameters: h.parameters
  }));
}

/**
 * Busca una herramienta por su nombre exacto.
 */
export function obtenerHerramientaPorNombre(nombre) {
  if (!nombre || typeof nombre !== "string") return null;
  return HERRAMIENTAS_CEREBRO.find((h) => h.name === nombre.trim()) || null;
}

/**
 * Ejecutor despachador de herramientas del cerebro.
 * Valida parámetros, aplica políticas de seguridad y devuelve resultados estructurados.
 */
export async function ejecutarHerramientaCerebro(nombre, args = {}, contexto = {}) {
  const herramienta = obtenerHerramientaPorNombre(nombre);
  if (!herramienta) {
    return {
      ok: false,
      error: `Herramienta desconocida: '${nombre}'.`
    };
  }

  switch (nombre) {
    case "editar_imagen": {
      const { operacionId, instruccion = "", parametros = {}, confirmadoPorUsuario = false } = args;
      const evaluacion = evaluarPoliticaDignidad({
        instruccion: `${instruccion} ${operacionId}`,
        operacionId
      });

      if (evaluacion.veredicto === "BLOQUEADO") {
        return {
          ok: false,
          bloqueado: true,
          veredicto: "BLOQUEADO",
          razon: evaluacion.motivo,
          protocolo: evaluacion.casoEspecialMenorEnRiesgo ? "CONANI / Línea Vida (809-200-1202)" : null,
          mensaje: evaluacion.mensajeRespetuoso
        };
      }

      if (evaluacion.veredicto === "CONFIRMAR" && !confirmadoPorUsuario) {
        return {
          ok: false,
          requiereConfirmacion: true,
          veredicto: "CONFIRMAR",
          advertencia: evaluacion.mensajeRespetuoso
        };
      }

      const op = obtenerOperacionPorId(operacionId);
      return {
        ok: true,
        ejecutada: true,
        operacion: op || { id: operacionId, nombre: "Operación personalizada" },
        pesoCuota: op?.pesoCuota || 1,
        motorSugerido: op?.motor || "local"
      };
    }

    case "identificar_especie_seguridad": {
      const { nombreEspecie, descripcion = "", nivelEscolar = "Primaria" } = args;
      const toxicidad = verificarToxicidadEspecie(nombreEspecie, descripcion);
      const curricular = vincularCurriculoMINERD(nombreEspecie, nivelEscolar);

      return {
        ok: true,
        especie: nombreEspecie,
        toxicidad,
        curricular
      };
    }

    case "ojo_visor": {
      return {
        ok: true,
        modoActivo: args.modo,
        zoom: Math.min(3.0, Math.max(1.0, args.zoom || 1.0)),
        preguntaRegistrada: args.preguntaCurricular || null
      };
    }

    case "consultar_base_datos": {
      return {
        ok: true,
        requiereConsultaDB: true,
        args
      };
    }

    case "exportar_plan_word": {
      return {
        ok: true,
        titulo: args.titulo,
        incluirIlustracion: Boolean(args.incluirIlustracion),
        formato: "docx",
        filasOficiales: 17
      };
    }

    default:
      return { ok: false, error: "Herramienta no implementada." };
  }
}
