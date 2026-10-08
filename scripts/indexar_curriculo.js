import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/**
 * CAPA 4: Indexador de búsqueda curricular oficial (MINERD / CON BASE)
 * Construye un índice unificado y segmentado con metadatos exactos:
 * (documento, nivel, grado, área, página real, tipo, estado_validacion).
 * 
 * Reglas de calidad:
 * 1. Desduplicación estricta por hash SHA-256 de texto normalizado.
 * 2. Detección contextual de Área y Grado para documentos transversales.
 * 3. Filtrado de ruido (créditos editoriales, páginas de firmas, textos ultra cortos).
 * 4. Metadatos pedagógicos listos para búsqueda local y Supabase pgvector.
 */

const AREAS_OFICIALES = [
  { nombre: "Lengua Española", terminos: ["lengua española", "lengua espanola", "comprensión oral", "producción escrita", "alfabetización"] },
  { nombre: "Matemática", terminos: ["matemática", "matematica", "numeración", "geometría", "geometria", "fracciones", "cálculo", "calculo"] },
  { nombre: "Ciencias Sociales", terminos: ["ciencias sociales", "historia", "geografía", "geografia", "identidad dominicana", "sociedad"] },
  { nombre: "Ciencias de la Naturaleza", terminos: ["ciencias de la naturaleza", "seres vivos", "ecosistema", "materia y energía", "salud"] },
  { nombre: "Educación Artística", terminos: ["educación artística", "educacion artistica", "artes visuales", "música", "teatro"] },
  { nombre: "Educación Física", terminos: ["educación física", "educacion fisica", "motricidad", "deporte escolar", "juegos"] },
  { nombre: "Inglés", terminos: ["inglés", "ingles", "lenguas extranjeras", "foreign languages"] },
  { nombre: "Francés", terminos: ["francés", "frances"] },
  { nombre: "Formación Integral Humana y Religiosa", terminos: ["formación integral", "formacion integral", "humana y religiosa"] }
];

const GRADOS_OFICIALES = [
  { nombre: "1er grado", terminos: ["primer grado", "1er grado", "1.º grado", "1ro de primaria", "1er. grado", "primer ciclo - 1"] },
  { nombre: "2do grado", terminos: ["segundo grado", "2do grado", "2.º grado", "2do de primaria", "2do. grado", "primer ciclo - 2"] },
  { nombre: "3er grado", terminos: ["tercer grado", "3er grado", "3.º grado", "3ro de primaria", "3er. grado", "primer ciclo - 3"] },
  { nombre: "4to grado", terminos: ["cuarto grado", "4to grado", "4.º grado", "4to de primaria", "4to. grado", "segundo ciclo - 4"] },
  { nombre: "5to grado", terminos: ["quinto grado", "5to grado", "5.º grado", "5to de primaria", "5to. grado", "segundo ciclo - 5"] },
  { nombre: "6to grado", terminos: ["sexto grado", "6to grado", "6.º grado", "6to de primaria", "6to. grado", "segundo ciclo - 6"] }
];

function normalizarTexto(txt) {
  return (txt || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function calcularHashTexto(txt) {
  const norm = normalizarTexto(txt);
  return crypto.createHash("sha256").update(norm).digest("hex");
}

function inferirArea(texto, areaDefecto) {
  const norm = normalizarTexto(texto);
  for (const a of AREAS_OFICIALES) {
    if (a.terminos.some(term => norm.includes(normalizarTexto(term)))) {
      return a.nombre;
    }
  }
  return areaDefecto || "General";
}

function inferirGrado(texto, gradoDefecto) {
  const norm = normalizarTexto(texto);
  for (const g of GRADOS_OFICIALES) {
    if (g.terminos.some(term => norm.includes(normalizarTexto(term)))) {
      return g.nombre;
    }
  }
  return gradoDefecto || "General";
}

function esRuidoEditorial(texto) {
  const norm = normalizarTexto(texto);
  if (texto.length < 65) return true;
  const patronesRuido = [
    "santo domingo, d.n.",
    "viceministerio de servicios tecnicos",
    "direccion general de curriculo",
    "diseno y diagramacion",
    "correccion de estilo",
    "impreso en la republica dominicana",
    "autoridades luis abinader",
    "todos los derechos reservados",
    "creditos ministeriales"
  ];
  return patronesRuido.some(p => norm.includes(p)) && texto.length < 250;
}

async function indexarCurriculo() {
  console.log("🔍 [Capa 4] Iniciando generación de índice de búsqueda curricular con desduplicación...");

  const baseDir = process.cwd();
  const capa2Dir = path.join(baseDir, "server", "curriculo", "capa2_texto");
  const capa3Dir = path.join(baseDir, "server", "curriculo", "capa3_estructurados");
  const capa4Dir = path.join(baseDir, "server", "curriculo", "capa4_indice");
  fs.mkdirSync(capa4Dir, { recursive: true });

  const fragmentos = [];
  const hashesVistos = new Set();
  let duplicadosDescartados = 0;
  let ruidoDescartado = 0;

  // 1. Indexar registros estructurados de Capa 3 (Prioridad Alta)
  const rutaCapa3 = path.join(capa3Dir, "curriculo_estructurado.json");
  if (fs.existsSync(rutaCapa3)) {
    const estructurados = JSON.parse(fs.readFileSync(rutaCapa3, "utf-8"));
    console.log(`📑 Indexando ${estructurados.length} registros estructurados de Capa 3...`);

    for (const item of estructurados) {
      const textoIndice = [
        item.tema || "",
        Array.isArray(item.competencias_especificas) ? item.competencias_especificas.join(" ") : "",
        item.contenidos?.texto_original || (item.contenidos?.items ? item.contenidos.items.join(" ") : ""),
        Array.isArray(item.indicadores_logro) ? item.indicadores_logro.join(" ") : ""
      ].join(" ");

      const hash = calcularHashTexto(textoIndice);
      if (hashesVistos.has(hash)) {
        duplicadosDescartados++;
        continue;
      }
      hashesVistos.add(hash);

      fragmentos.push({
        id: `chunk_${item.id}`,
        tipo: "matriz_estructurada",
        prioridad: 1,
        documento: item.documento_fuente,
        nivel: item.nivel,
        grado: item.grado,
        area: item.area,
        pagina: item.pagina_referencia,
        tema: item.tema,
        competencias: item.competencias_especificas,
        contenidos: item.contenidos,
        indicadores: item.indicadores_logro,
        estado_validacion: "pendiente de validación por experto",
        texto_busqueda: normalizarTexto(textoIndice)
      });
    }
  }

  // 2. Indexar páginas de texto de Capa 2
  const archivosTexto = fs.readdirSync(capa2Dir).filter((f) => f.endsWith(".json") && !f.startsWith("manifiesto"));
  console.log(`📄 Indexando páginas de texto de Capa 2 (${archivosTexto.length} archivos)...`);

  for (const archivo of archivosTexto) {
    const docData = JSON.parse(fs.readFileSync(path.join(capa2Dir, archivo), "utf-8"));
    let docTitulo = docData.titulo;
    if (docTitulo.includes("adecuacion curricular nivel primario")) {
      docTitulo = "Adecuación Curricular del Nivel Primario (MINERD)";
    } else if (docTitulo.includes("adecuacion curricular nivel secundario")) {
      docTitulo = "Adecuación Curricular del Nivel Secundario (MINERD, 2023)";
    } else if (docTitulo.includes("diseno curricular nivel inicial")) {
      docTitulo = "Diseño Curricular del Nivel Inicial (MINERD)";
    } else if (docTitulo.includes("diseno curricular primaria primer ciclo")) {
      docTitulo = "Diseño Curricular Nivel Primario - Primer Ciclo (MINERD)";
    } else if (docTitulo.includes("naturaleza de las areas")) {
      docTitulo = "Naturaleza de las Áreas Curriculares (MINERD)";
    } else if (docTitulo.includes("registro grado secundaria 1ro")) {
      docTitulo = "Registro de Grado - 1er Grado Secundaria (MINERD)";
    } else if (docTitulo.includes("registro grado secundaria 2do")) {
      docTitulo = "Registro de Grado - 2do Grado Secundaria (MINERD)";
    } else if (docTitulo.includes("registro grado secundaria 3ro")) {
      docTitulo = "Registro de Grado - 3er Grado Secundaria (MINERD)";
    } else if (docTitulo.includes("unicef con base manual")) {
      docTitulo = "Manual de Organización del Programa CON BASE (MINERD / UNICEF)";
    }

    let areaActual = docData.area || "General";
    let gradoActual = docData.grado || "General";

    for (const pag of docData.paginas) {
      const texto = pag.texto;
      if (!texto || texto.length < 50) continue;

      // Actualizar área o grado contextual si la página lo encabeza
      areaActual = inferirArea(texto, areaActual);
      gradoActual = inferirGrado(texto, gradoActual);

      // Dividir la página en fragmentos pedagógicos (párrafos de tamaño adecuado)
      const parrafos = texto
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter((p) => p.length >= 50);

      const itemsAProcesar = parrafos.length > 0 ? parrafos : [texto.trim()];

      itemsAProcesar.forEach((parrafo, idx) => {
        if (esRuidoEditorial(parrafo)) {
          ruidoDescartado++;
          return;
        }

        const hash = calcularHashTexto(parrafo);
        if (hashesVistos.has(hash)) {
          duplicadosDescartados++;
          return;
        }
        hashesVistos.add(hash);

        const areaFragmento = inferirArea(parrafo, areaActual);
        const gradoFragmento = inferirGrado(parrafo, gradoActual);

        fragmentos.push({
          id: `chunk_${docData.documento_id}_p${pag.numero}_f${idx + 1}`,
          tipo: "fragmento_texto_pagina",
          prioridad: 2,
          documento: docTitulo,
          nivel: docData.nivel || "primario",
          grado: gradoFragmento,
          area: areaFragmento,
          pagina: pag.numero,
          texto: parrafo,
          estado_validacion: "pendiente de validación por experto",
          texto_busqueda: normalizarTexto(parrafo)
        });
      });
    }
  }

  // Guardar índice completo
  const rutaIndice = path.join(capa4Dir, "indice_curriculo.json");
  fs.writeFileSync(rutaIndice, JSON.stringify(fragmentos, null, 2), "utf-8");

  // Estadísticas desglosadas por documento
  const conteoPorDoc = {};
  const conteoPorNivel = {};
  fragmentos.forEach((f) => {
    conteoPorDoc[f.documento] = (conteoPorDoc[f.documento] || 0) + 1;
    conteoPorNivel[f.nivel] = (conteoPorNivel[f.nivel] || 0) + 1;
  });

  const manifiestoIndice = {
    total_fragmentos: fragmentos.length,
    fragmentos_estructurados: fragmentos.filter((f) => f.prioridad === 1).length,
    fragmentos_texto: fragmentos.filter((f) => f.prioridad === 2).length,
    duplicados_descartados: duplicadosDescartados,
    ruido_editorial_descartado: ruidoDescartado,
    distribucion_por_nivel: conteoPorNivel,
    distribucion_por_documento: conteoPorDoc,
    fecha_generacion: new Date().toISOString(),
    estado_general_validacion: "pendiente de validación por experto"
  };

  fs.writeFileSync(
    path.join(capa4Dir, "manifiesto_indice.json"),
    JSON.stringify(manifiestoIndice, null, 2),
    "utf-8"
  );

  console.log(`✅ [Capa 4] Índice generado exitosamente:`);
  console.log(`   - Total fragmentos válidos: ${fragmentos.length}`);
  console.log(`   - Duplicados eliminados: ${duplicadosDescartados}`);
  console.log(`   - Párrafos de ruido filtrados: ${ruidoDescartado}`);
  console.log(`   - Distribución por nivel:`, conteoPorNivel);
}

indexarCurriculo();
