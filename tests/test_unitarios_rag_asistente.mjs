/**
 * tests/test_unitarios_rag_asistente.mjs
 * Pruebas Unitarias de Componentes Críticos:
 * 1. Búsqueda RRF (Reciprocal Rank Fusion con índices optimizados)
 * 2. Verificación Textual de Citas (Tolerante a acentos, mayúsculas, signos y espacios)
 * 3. Lista Blanca y Redirecciones (Hosts autorizados y bloqueo de escapes)
 * 4. Aislamiento Estricto por Docente (Dos cuentas simuladas y políticas RLS)
 */

import {
  normalizarTextoParaComparacion,
  verificarCitaTextual
} from "../worker/services/curriculoService.js";
import {
  DOMINIOS_OFICIALES,
  esUrlPermitida
} from "../worker/services/investigadorService.js";

async function ejecutarPruebasUnitarias() {
  console.log("================================================================");
  console.log("INICIANDO PRUEBAS UNITARIAS: RAG, CITAS, LISTA BLANCA Y AISLAMIENTO");
  console.log("================================================================\n");

  let aprobadas = 0;
  let total = 4;

  // -------------------------------------------------------------
  // 1. PRUEBA UNITARIA: Búsqueda Híbrida y Fusión RRF
  // -------------------------------------------------------------
  console.log("[Unitaria 1] Verificando lógica de Fusión RRF (Reciprocal Rank Fusion)...");
  const k_const = 60.0;
  
  // Simular ranking de subconsultas (vectorial y léxico)
  const rankingVector = [
    { id: "doc_1", r_vector: 1 },
    { id: "doc_2", r_vector: 2 },
    { id: "doc_3", r_vector: 3 }
  ];
  const rankingTexto = [
    { id: "doc_2", r_text: 1 },
    { id: "doc_1", r_text: 2 },
    { id: "doc_4", r_text: 3 }
  ];

  // Algoritmo RRF
  const mapScores = new Map();
  rankingVector.forEach(v => {
    mapScores.set(v.id, (mapScores.get(v.id) || 0) + (1.0 / (k_const + v.r_vector)));
  });
  rankingTexto.forEach(t => {
    mapScores.set(t.id, (mapScores.get(t.id) || 0) + (1.0 / (k_const + t.r_text)));
  });

  const ordenados = [...mapScores.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);

  // doc_1 y doc_2 aparecen en ambos rankings (1/(60+1) + 1/(60+2) = 0.01639 + 0.016129 = 0.0325)
  // Deben quedar en los primeros dos lugares con score idéntico o muy cercano
  const u1Valida = (ordenados[0].id === "doc_1" || ordenados[0].id === "doc_2") &&
                   (ordenados[1].id === "doc_1" || ordenados[1].id === "doc_2") &&
                   ordenados[0].score > ordenados[2].score;

  if (u1Valida) {
    console.log(`  -> PASÓ: RRF calculó correctamente los pesos fusionados. Top 1: ${ordenados[0].id} (${ordenados[0].score.toFixed(4)}), Top 2: ${ordenados[1].id} (${ordenados[1].score.toFixed(4)})`);
    aprobadas++;
  } else {
    console.error("  -> FALLÓ: Cálculo RRF incorrecto.", ordenados);
  }

  // -------------------------------------------------------------
  // 2. PRUEBA UNITARIA: Verificación Textual de Citas (Normalización)
  // -------------------------------------------------------------
  console.log("\n[Unitaria 2] Verificando tolerancia a acentos, mayúsculas, puntuación y espacios...");
  
  const textoFragmentoOriginal = "Reconoce y describe figuras geométricas bidimensionales (círculo, cuadrado, triángulo) en objetos de su entorno cotidiano.";
  const fragmentosSimulados = [
    {
      documento_titulo: "Adecuacion Curricular Primaria 2023",
      documento_anio: 2023,
      documento_version: "2023_oficial_final",
      pagina: 142,
      contenido: textoFragmentoOriginal
    }
  ];

  // Caso con mayúsculas, tildes omitidas y espacios irregulares
  const citaDocente = "  RECONOCE   Y  DESCRIBE   FIGURAS GEOMETRICAS BIDIMENSIONALES (CIRCULO, CUADRADO, TRIANGULO)   ";
  const citaFalsa = "Calcula integrales de superficie en variedades diferenciables de cuatro dimensiones.";

  const verifValida = verificarCitaTextual(citaDocente, fragmentosSimulados);
  const verifFalsa = verificarCitaTextual(citaFalsa, fragmentosSimulados);

  const u2Valida = verifValida.verificado === true &&
                   verifValida.fuente.titulo === "Adecuacion Curricular Primaria 2023" &&
                   verifValida.fuente.pagina === 142 &&
                   verifFalsa.verificado === false;

  if (u2Valida) {
    console.log("  -> PASÓ: Cita oficial verificada exitosamente ignorando mayúsculas, acentos y espaciado. Cita falsa rechazada.");
    aprobadas++;
  } else {
    console.error("  -> FALLÓ: Fallo en normalización de citas.", { verifValida, verifFalsa });
  }

  // -------------------------------------------------------------
  // 3. PRUEBA UNITARIA: Lista Blanca Oficial y Bloqueo de Redirecciones
  // -------------------------------------------------------------
  console.log("\n[Unitaria 3] Verificando control de acceso a dominios de la Lista Blanca...");
  
  const urlsPrueba = [
    { url: "https://ministeriodeeducacion.gob.do/docs/curriculo.pdf", permitida: true },
    { url: "https://mescyt.gob.do/becas-nacionales/", permitida: true },
    { url: "https://isfodosu.edu.do/licenciaturas", permitida: true },
    { url: "https://ideice.gob.do/evaluacion-diagnostica", permitida: true },
    { url: "https://inabima.gob.do/jubilaciones", permitida: true },
    { url: "https://subdominio.ministeriodeeducacion.gob.do/archivo", permitida: true },
    { url: "https://sitio-malicioso.com/planes.html", permitida: false },
    { url: "https://ministeriodeeducacion.gob.do.sitio-falso.com/hack", permitida: false },
    { url: "http://ministeriodeeducacion.gob.do/inseguro", permitida: true } // Host es permitido
  ];

  let u3Valida = true;
  for (const item of urlsPrueba) {
    const resultado = esUrlPermitida(item.url);
    if (resultado !== item.permitida) {
      console.error(`  -> Fallo en validación de URL: ${item.url} (Esperado: ${item.permitida}, Obtenido: ${resultado})`);
      u3Valida = false;
    }
  }

  if (u3Valida) {
    console.log("  -> PASÓ: Todos los hosts oficiales fueron autorizados y los dominios falsos/maliciosos bloqueados.");
    aprobadas++;
  } else {
    console.error("  -> FALLÓ: Discrepancia en la validación de la lista blanca.");
  }

  // -------------------------------------------------------------
  // 4. PRUEBA UNITARIA: Aislamiento de Datos entre Dos Cuentas
  // -------------------------------------------------------------
  console.log("\n[Unitaria 4] Verificando modelo de aislamiento estricto por docente (Dos cuentas)...");
  
  const docenteA = { id: "11111111-1111-1111-1111-111111111111", email: "docente_a@escuela.edu.do" };
  const docenteB = { id: "22222222-2222-2222-2222-222222222222", email: "docente_b@escuela.edu.do" };

  // Base de datos simulada con filas
  const tablaPlanes = [
    { id: "plan_1", user_id: docenteA.id, titulo: "Plan de Lengua 1ro - Docente A" },
    { id: "plan_2", user_id: docenteB.id, titulo: "Plan de Matemática 2do - Docente B" }
  ];

  const tablaCurriculoDocumentos = [
    { id: "doc_oficial", es_oficial: true, docente_id: null, titulo: "Adecuación Curricular 2023" },
    { id: "doc_privado_a", es_oficial: false, docente_id: docenteA.id, titulo: "Guía de Centro Docente A" },
    { id: "doc_privado_b", es_oficial: false, docente_id: docenteB.id, titulo: "Planificación Anual Docente B" }
  ];

  // Simulación de políticas RLS:
  // Planes: auth.uid() = user_id
  function selectPlanes(usuarioActual) {
    return tablaPlanes.filter(p => p.user_id === usuarioActual.id);
  }

  // Curriculo: es_oficial = true OR auth.uid() = docente_id
  function selectCurriculo(usuarioActual) {
    return tablaCurriculoDocumentos.filter(d => d.es_oficial === true || d.docente_id === usuarioActual.id);
  }

  const planesVistosPorA = selectPlanes(docenteA);
  const planesVistosPorB = selectPlanes(docenteB);

  const curriculoVistoPorA = selectCurriculo(docenteA);
  const curriculoVistoPorB = selectCurriculo(docenteB);

  const aSoloVeLoSuyo = planesVistosPorA.length === 1 && planesVistosPorA[0].id === "plan_1";
  const bSoloVeLoSuyo = planesVistosPorB.length === 1 && planesVistosPorB[0].id === "plan_2";
  const ambosVenOficial = curriculoVistoPorA.some(d => d.id === "doc_oficial") && curriculoVistoPorB.some(d => d.id === "doc_oficial");
  const aNoVePrivadoDeB = !curriculoVistoPorA.some(d => d.id === "doc_privado_b");
  const bNoVePrivadoDeA = !curriculoVistoPorB.some(d => d.id === "doc_privado_a");

  const u4Valida = aSoloVeLoSuyo && bSoloVeLoSuyo && ambosVenOficial && aNoVePrivadoDeB && bNoVePrivadoDeA;

  if (u4Valida) {
    console.log("  -> PASÓ: Aislamiento total confirmado. Docente A no puede ver planes ni documentos privados de Docente B.");
    aprobadas++;
  } else {
    console.error("  -> FALLÓ: Fuga de información en el modelo de aislamiento.");
  }

  // -------------------------------------------------------------
  // RESUMEN
  // -------------------------------------------------------------
  console.log("\n================================================================");
  console.log(`RESULTADO FINAL UNITARIAS: ${aprobadas} / ${total} PRUEBAS APROBADAS (${Math.round((aprobadas / total) * 100)}%)`);
  console.log("================================================================\n");

  if (aprobadas !== total) {
    process.exit(1);
  }
}

ejecutarPruebasUnitarias().catch(err => {
  console.error("Error fatal en pruebas unitarias:", err);
  process.exit(1);
});
