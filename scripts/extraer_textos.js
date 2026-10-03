import fs from "node:fs";
import path from "node:path";
import { PDFParse } from "pdf-parse";

/**
 * CAPA 2: Extracción y limpieza de texto por página
 * Lee los documentos de Capa 1 y genera archivos de texto estructurado por página.
 */

async function extraerTextos() {
  console.log("📄 [Capa 2] Iniciando extracción de textos por página...");

  const baseDir = process.cwd();
  const capa1Dir = path.join(baseDir, "server", "curriculo", "capa1_originales");
  const capa2Dir = path.join(baseDir, "server", "curriculo", "capa2_texto");
  const manifiestoPath = path.join(capa1Dir, "manifiesto_originales.json");

  if (!fs.existsSync(manifiestoPath)) {
    console.error("❌ No se encontró manifiesto_originales.json en Capa 1");
    process.exit(1);
  }

  const manifiesto = JSON.parse(fs.readFileSync(manifiestoPath, "utf-8"));
  fs.mkdirSync(capa2Dir, { recursive: true });

  const resultadosManifiesto = [];

  for (const doc of manifiesto) {
    const filePath = path.resolve(doc.ruta);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ Archivo no encontrado: ${filePath}`);
      continue;
    }

    console.log(`🔍 Procesando: ${doc.nombre_archivo}...`);
    let paginas = [];

    if (filePath.endsWith(".pdf")) {
      const buffer = fs.readFileSync(filePath);
      const parser = new PDFParse({ data: buffer });
      await parser.load();
      const rawResult = await parser.getText();
      const fullText = rawResult.text || "";

      // Dividir por delimitador estándar de pdf-parse: "-- X of Y --"
      const pageSplitRegex = /--\s*(\d+)\s+of\s+(\d+)\s*--/g;
      let match;
      const markers = [];
      while ((match = pageSplitRegex.exec(fullText)) !== null) {
        markers.push({
          pageNumber: parseInt(match[1], 10),
          index: match.index,
          markerLength: match[0].length,
        });
      }

      if (markers.length > 0) {
        for (let i = 0; i < markers.length; i++) {
          const current = markers[i];
          const startIndex = current.index + current.markerLength;
          const endIndex = i + 1 < markers.length ? markers[i + 1].index : fullText.length;
          let content = fullText.slice(startIndex, endIndex).trim();

          // Limpieza de caracteres no imprimibles y normalización de espacios
          content = content
            .replace(/\r\n/g, "\n")
            .replace(/\n{3,}/g, "\n\n")
            .replace(/[ \t]+/g, " ");

          paginas.push({
            numero: current.pageNumber,
            texto: content,
          });
        }
      } else {
        // Si no tiene marcadores, tratar como documento de página única o segmentar por párrafos
        paginas.push({
          numero: 1,
          texto: fullText.trim(),
        });
      }
    } else {
      // Formato texto plano / markdown
      const text = fs.readFileSync(filePath, "utf-8");
      paginas.push({
        numero: 1,
        texto: text.trim(),
      });
    }

    const docCapa2 = {
      documento_id: doc.id,
      titulo: doc.nombre_archivo.replace(/_/g, " ").replace(".pdf", ""),
      institucion: doc.institucion || "MINERD",
      nivel: doc.nivel || "primario",
      grado: doc.grado || "multigrado",
      area: doc.area || "General",
      url_fuente: doc.url_fuente,
      sha256: doc.sha256,
      total_paginas: paginas.length,
      fecha_extraccion: new Date().toISOString(),
      paginas,
    };

    const outPath = path.join(capa2Dir, `${doc.id}.json`);
    fs.writeFileSync(outPath, JSON.stringify(docCapa2, null, 2));

    resultadosManifiesto.push({
      documento_id: doc.id,
      archivo_json: `${doc.id}.json`,
      titulo: docCapa2.titulo,
      total_paginas: paginas.length,
      area: docCapa2.area,
      grado: docCapa2.grado,
    });

    console.log(`✅ Extraídas ${paginas.length} páginas para ${doc.id}`);
  }

  fs.writeFileSync(
    path.join(capa2Dir, "manifiesto_texto.json"),
    JSON.stringify(resultadosManifiesto, null, 2)
  );

  console.log("✨ [Capa 2] Extracción de textos completada exitosamente.");
}

extraerTextos().catch((err) => {
  console.error("❌ Error en extracción Capa 2:", err);
  process.exit(1);
});
