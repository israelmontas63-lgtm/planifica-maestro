import fs from "node:fs";
import path from "node:path";

/**
 * CAPA 4: Indexador de búsqueda curricular
 * Construye un índice segmentado por fragmentos con metadatos exactos:
 * (documento, grado, área, página real, tipo, estado_validacion).
 */

async function indexarCurriculo() {
  console.log("🔍 [Capa 4] Iniciando generación de índice de búsqueda curricular...");

  const baseDir = process.cwd();
  const capa2Dir = path.join(baseDir, "server", "curriculo", "capa2_texto");
  const capa3Dir = path.join(baseDir, "server", "curriculo", "capa3_estructurados");
  const capa4Dir = path.join(baseDir, "server", "curriculo", "capa4_indice");
  fs.mkdirSync(capa4Dir, { recursive: true });

  const fragmentos = [];

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
        texto_busqueda: textoIndice.toLowerCase()
      });
    }
  }

  // 2. Indexar páginas de texto limpio de Capa 2
  const archivosTexto = fs.readdirSync(capa2Dir).filter((f) => f.endsWith(".json") && !f.startsWith("manifiesto"));
  console.log(`📄 Indexando páginas de texto de Capa 2 (${archivosTexto.length} archivos)...`);

  for (const archivo of archivosTexto) {
    const docData = JSON.parse(fs.readFileSync(path.join(capa2Dir, archivo), "utf-8"));
    const docTitulo = docData.titulo;
    const docArea = docData.area;
    const docGrado = docData.grado;
    const docNivel = docData.nivel;

    for (const pag of docData.paginas) {
      const texto = pag.texto;
      if (!texto || texto.length < 50) continue;

      // Dividir la página en fragmentos de máximo 600 caracteres o párrafos significativos
      const parrafos = texto.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length > 40);

      if (parrafos.length === 0) {
        parrafos.push(texto.trim());
      }

      parrafos.forEach((parrafo, idx) => {
        fragmentos.push({
          id: `chunk_${docData.documento_id}_p${pag.numero}_f${idx + 1}`,
          tipo: "fragmento_texto_pagina",
          prioridad: 2,
          documento: docTitulo,
          nivel: docNivel,
          grado: docGrado,
          area: docArea,
          pagina: pag.numero,
          texto: parrafo,
          estado_validacion: "pendiente de validación por experto",
          texto_busqueda: parrafo.toLowerCase()
        });
      });
    }
  }

  // Guardar índice completo
  const rutaIndice = path.join(capa4Dir, "indice_curriculo.json");
  fs.writeFileSync(rutaIndice, JSON.stringify(fragmentos, null, 2), "utf-8");

  const manifiestoIndice = {
    total_fragmentos: fragmentos.length,
    fragmentos_estructurados: fragmentos.filter((f) => f.prioridad === 1).length,
    fragmentos_texto: fragmentos.filter((f) => f.prioridad === 2).length,
    fecha_generacion: new Date().toISOString(),
    estado_general_validacion: "pendiente de validación por experto"
  };

  fs.writeFileSync(
    path.join(capa4Dir, "manifiesto_indice.json"),
    JSON.stringify(manifiestoIndice, null, 2),
    "utf-8"
  );

  console.log(`✅ [Capa 4] Índice generado exitosamente:`);
  console.log(`   - Total fragmentos indexados: ${fragmentos.length}`);
  console.log(`   - Fragmentos estructurados (prioridad 1): ${manifiestoIndice.fragmentos_estructurados}`);
  console.log(`   - Fragmentos de texto de páginas (prioridad 2): ${manifiestoIndice.fragmentos_texto}`);
  console.log(`   - Estado de validación: "pendiente de validación por experto"`);
}

indexarCurriculo();
