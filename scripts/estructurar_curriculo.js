import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { DATOS_CON_BASE } = require("../server/curriculum/contextoConBase.js");

/**
 * CAPA 3: Datos estructurados del currículo oficial
 * Normaliza y clasifica competencias, contenidos e indicadores de logro por nivel, grado y área.
 * 
 * Reglas estrictas:
 * 1. Validación campo por campo sin ocultar fallos en try/catch general.
 * 2. Si a un registro le falta un campo obligatorio, se salta y se anota en el registro de problemas.
 * 3. Prohibido inventar datos o rellenar huecos.
 * 4. Toda etiqueta de validación debe ser: "pendiente de validación por experto".
 */

function normalizarTexto(txt) {
  if (!txt || typeof txt !== "string") return "";
  return txt.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
}

function extraerPaginaReferencia(texto) {
  if (!texto || typeof texto !== "string") return null;
  const m = texto.match(/(?:pp?\.?|p[aá]gs?\.?)\s*([0-9]+(?:\s*(?:-|–|y|,)\s*[0-9]+)*)/i);
  if (m && /\d/.test(m[1])) return m[1].trim();
  const m2 = texto.match(/(?:Multigrado|Secuencia\s*\d*)\s*•\s*([0-9]+)/i);
  if (m2 && /\d/.test(m2[1])) return m2[1].trim();
  return null;
}

function parsearBloqueCurricular(texto) {
  if (!texto || typeof texto !== "string") return null;

  const paginaRef = extraerPaginaReferencia(texto);

  // Extraer competencias
  let competencias = [];
  const compMatch = texto.match(/COMPETENCIA(?:S)?(?:\s*ESPEC[IÍ]FICAS?)?:\s*([^\n\r]+(?:\r?\n(?!(?:CONTENIDOS|INDICADORES|Correspondiente|EJE))[^\n\r]+)*)/i);
  if (compMatch) {
    competencias = compMatch[1]
      .split("\n")
      .map((c) => normalizarTexto(c))
      .filter((c) => c.length > 5);
  } else {
    const compMat = texto.match(/Competencias\s+espec[ií]ficas\s*([\s\S]*?)(?=CONTENIDOS|EJE TEM[AÁ]TICO|INDICADORES)/i);
    if (compMat) {
      competencias = compMat[1]
        .split("\n")
        .map((c) => normalizarTexto(c.replace(/^•\s*/, "")))
        .filter((c) => c.length > 10);
    }
  }

  // Extraer contenidos sin inventar clasificaciones si el texto no las separa explícitamente
  let contenidos = null;
  const contMatch = texto.match(/CONTENIDOS\s*([\s\S]*?)(?=INDICADORES DE LOGRO)/i);
  if (contMatch) {
    const rawCont = contMatch[1].trim();
    if (rawCont.length > 10) {
      const lineas = rawCont.split("\n").map(s => normalizarTexto(s.replace(/^•\s*/, ""))).filter(s => s.length > 3);
      contenidos = {
        texto_original: normalizarTexto(rawCont),
        items: lineas
      };
    }
  }

  // Extraer indicadores de logro
  let indicadores = [];
  const indMatch = texto.match(/INDICADORES DE LOGRO\s*([\s\S]*?)(?=Correspondiente|\d+\s*•|SECUENCIA|$)/i);
  if (indMatch) {
    indicadores = indMatch[1]
      .split("\n")
      .map((s) => normalizarTexto(s.replace(/^•\s*/, "")))
      .filter((s) => s.length > 8);
  }

  return {
    pagina_referencia: paginaRef,
    competencias,
    contenidos,
    indicadores
  };
}

async function estructurarCurriculo() {
  console.log("🧩 [Capa 3] Iniciando estructuración con validación rigurosa de campos...");

  const baseDir = process.cwd();
  const capa2Dir = path.join(baseDir, "server", "curriculo", "capa2_texto");
  const capa3Dir = path.join(baseDir, "server", "curriculo", "capa3_estructurados");
  fs.mkdirSync(capa3Dir, { recursive: true });

  const estructurados = [];
  const registroProblemas = [];

  // CAMPOS OBLIGATORIOS QUE DEBE CUMPLIR CADA REGISTRO
  const camposRequeridos = [
    "id",
    "tipo",
    "institucion",
    "nivel",
    "grado",
    "area",
    "tema",
    "documento_fuente",
    "pagina_referencia",
    "estado_validacion",
    "competencias_especificas",
    "contenidos",
    "indicadores_logro"
  ];

  function validarRegistro(rec) {
    const faltantes = [];
    for (const campo of camposRequeridos) {
      const val = rec[campo];
      if (val === undefined || val === null || val === "") {
        faltantes.push(campo);
      } else if (Array.isArray(val) && val.length === 0) {
        faltantes.push(campo);
      } else if (typeof val === "object" && !Array.isArray(val) && Object.keys(val).length === 0) {
        faltantes.push(campo);
      }
    }
    return faltantes;
  }

  // 1. Procesamiento de secuencias oficiales de CON BASE
  console.log("📚 Procesando matrices curriculares de secuencias CON BASE...");
  for (const areaKey of ["lengua", "matematica"]) {
    const areaNombre = areaKey === "lengua" ? "Lengua Española" : "Matemática";
    const docFuente = areaKey === "lengua"
      ? "Guía Didáctica de Lengua Española (MINERD / CON BASE)"
      : "Guía Didáctica de Matemática (MINERD / CON BASE)";

    const secuencias = DATOS_CON_BASE[areaKey] || {};

    for (let s = 1; s <= 6; s++) {
      const secKey = `secuencia_${s}`;
      const secData = secuencias[secKey];
      if (!secData) {
        registroProblemas.push({
          documento: docFuente,
          registro_id: `secuencia_${s}_${areaKey}`,
          campo_faltante: "secuencia_completa",
          detalle: `No existe la secuencia ${s} en los datos oficiales de ${areaNombre}.`,
          fecha: new Date().toISOString()
        });
        continue;
      }

      for (const gradoKey of ["primero", "segundo", "tercero"]) {
        const gradoNombre = gradoKey === "primero" ? "1er grado" : gradoKey === "segundo" ? "2do grado" : "3er grado";
        const textoGrado = secData[gradoKey];

        const recId = `matriz_${areaKey}_secuencia_${s}_${gradoKey}`;

        if (!textoGrado || typeof textoGrado !== "string" || textoGrado.trim().length === 0) {
          registroProblemas.push({
            documento: docFuente,
            registro_id: recId,
            campo_faltante: "texto_grado",
            detalle: `Texto curricular vacío para ${gradoNombre} en secuencia ${s} (${areaNombre}).`,
            fecha: new Date().toISOString()
          });
          continue;
        }

        const parseado = parsearBloqueCurricular(textoGrado);

        const candidato = {
          id: recId,
          tipo: "matriz_secuencia_curricular",
          institucion: "MINERD / CON BASE",
          nivel: "primario",
          grado: gradoNombre,
          area: areaNombre,
          tema: secData.titulo,
          bloque_guia: `Secuencia Didáctica ${s}`,
          documento_fuente: docFuente,
          pagina_referencia: parseado?.pagina_referencia,
          url_fuente: "https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo",
          estado_validacion: "pendiente de validación por experto",
          competencias_especificas: parseado?.competencias || [],
          contenidos: parseado?.contenidos,
          indicadores_logro: parseado?.indicadores || []
        };

        const faltantes = validarRegistro(candidato);

        if (faltantes.length > 0) {
          console.warn(`⚠️ [Capa 3] Registro descartado por campos faltantes: ${recId} -> Faltan: ${faltantes.join(", ")}`);
          registroProblemas.push({
            documento: docFuente,
            registro_id: recId,
            campo_faltante: faltantes.join(", "),
            detalle: `Descartado sin rellenar huecos. No se encontraron en el texto oficial los campos requeridos: ${faltantes.join(", ")}.`,
            fecha: new Date().toISOString()
          });
          continue;
        }

        estructurados.push(candidato);
      }
    }
  }

  // 2. Extracción de inserciones curriculares detectadas en páginas de Capa 2
  console.log("🔍 Analizando páginas de Capa 2 para estructurar inserciones explícitas...");
  const archivosTexto = fs.readdirSync(capa2Dir).filter((f) => f.endsWith(".json") && !f.startsWith("manifiesto"));

  for (const archivo of archivosTexto) {
    const docData = JSON.parse(fs.readFileSync(path.join(capa2Dir, archivo), "utf-8"));
    const docTitulo = docData.titulo;
    const docArea = docData.area;
    const docNivel = docData.nivel;

    for (const pag of docData.paginas) {
      const texto = pag.texto;
      if (!texto || texto.length < 80) continue;

      const esInsercionCurricular = /INSERCI[OÓ]N\s+CURRICULAR/i.test(texto) ||
        (/COMPETENCIAS?\s+ESPEC[IÍ]FICAS?/i.test(texto) && /INDICADORES\s+DE\s+LOGRO/i.test(texto) && /CONTENIDOS/i.test(texto));

      if (esInsercionCurricular) {
        const pagRecId = `${docData.documento_id}_pag_${pag.numero}`;
        const parseado = parsearBloqueCurricular(texto);

        let gradoDetectado = null;
        if (/primer\s+grado|1(?:er|ro)?\s+grado/i.test(texto)) gradoDetectado = "1er grado";
        else if (/segundo\s+grado|2(?:do)?\s+grado/i.test(texto)) gradoDetectado = "2do grado";
        else if (/tercer\s+grado|3(?:er|ro)?\s+grado/i.test(texto)) gradoDetectado = "3er grado";
        else if (/multigrado/i.test(docData.grado)) gradoDetectado = "multigrado (1er ciclo)";

        const temaMatch = texto.match(/SECUENCIA[^\n\r]*\n([^\n\r]+)/i) || texto.match(/T\s*extos\s+que\s+se[^\n\r]*:\s*([^\n\r]+)/i);
        const tema = temaMatch ? normalizarTexto(temaMatch[1]) : `Unidad Curricular Pág. ${pag.numero}`;

        const candidatoPag = {
          id: pagRecId,
          tipo: "fragmento_matriz_curricular_pagina",
          institucion: docData.institucion || "MINERD / CON BASE",
          nivel: docNivel,
          grado: gradoDetectado,
          area: docArea,
          tema,
          bloque_guia: `Página ${pag.numero}`,
          documento_fuente: docTitulo,
          pagina_referencia: String(pag.numero),
          url_fuente: docData.url_fuente,
          estado_validacion: "pendiente de validación por experto",
          competencias_especificas: parseado?.competencias || [],
          contenidos: parseado?.contenidos,
          indicadores_logro: parseado?.indicadores || []
        };

        const faltantes = validarRegistro(candidatoPag);

        if (faltantes.length > 0) {
          registroProblemas.push({
            documento: docTitulo,
            registro_id: pagRecId,
            campo_faltante: faltantes.join(", "),
            detalle: `Página de inserción curricular incompleta en documento oficial. Descartada sin inventar datos. Faltaron: ${faltantes.join(", ")}.`,
            fecha: new Date().toISOString()
          });
          continue;
        }

        estructurados.push(candidatoPag);
      }
    }
  }

  // Guardar archivo estructurado, manifiesto y registro de problemas
  const outputPath = path.join(capa3Dir, "curriculo_estructurado.json");
  fs.writeFileSync(outputPath, JSON.stringify(estructurados, null, 2), "utf-8");

  const problemasPath = path.join(capa3Dir, "registro_problemas.json");
  fs.writeFileSync(problemasPath, JSON.stringify(registroProblemas, null, 2), "utf-8");

  const manifiestoCapa3 = {
    total_registros_estructurados: estructurados.length,
    total_registros_con_problemas_omitidos: registroProblemas.length,
    fecha_generacion: new Date().toISOString(),
    areas_cubiertas: [...new Set(estructurados.map((e) => e.area))],
    grados_cubiertos: [...new Set(estructurados.map((e) => e.grado))],
    niveles_cubiertos: [...new Set(estructurados.map((e) => e.nivel))],
    estado_general_validacion: "pendiente de validación por experto"
  };

  fs.writeFileSync(
    path.join(capa3Dir, "manifiesto_estructurados.json"),
    JSON.stringify(manifiestoCapa3, null, 2),
    "utf-8"
  );

  console.log(`✅ [Capa 3] Finalizado:`);
  console.log(`   - Registros estructurados válidos: ${estructurados.length}`);
  console.log(`   - Registros omitidos por campos faltantes: ${registroProblemas.length}`);
  console.log(`   - Estado de validación asignado a todos: "pendiente de validación por experto"`);
}

estructurarCurriculo();
