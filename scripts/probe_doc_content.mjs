import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");

const documents = [
  {
    name: "Adecuación Curricular Nivel Inicial FINAL 2023",
    url: "https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo/1Z1p-adecuacion-curricular-nivel-inicial-final-2023pdf.pdf",
    institucion: "MINERD",
    nivel: "Inicial",
    ciclo: "1.er y 2.º Ciclo",
    grado: "Maternal, Kínder, Pre-primario",
    area: "Todas las dimensiones",
    anio: 2023,
    version: "2023_oficial_final"
  },
  {
    name: "Adecuacion Curricular Primaria 2023",
    url: "https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo/lq58-adecuacion-curricular-primariapdf.pdf",
    institucion: "MINERD",
    nivel: "Primario",
    ciclo: "1.er y 2.º Ciclo",
    grado: "1.º a 6.º de Primaria",
    area: "Todas las áreas",
    anio: 2023,
    version: "2023_oficial_final"
  },
  {
    name: "Adecuación Secundaria 2023",
    url: "https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo/Ht7X-adecuacion-secundaria-2023pdf.pdf",
    institucion: "MINERD",
    nivel: "Secundario",
    ciclo: "1.er y 2.º Ciclo",
    grado: "1.º a 6.º de Secundaria",
    area: "Todas las áreas",
    anio: 2023,
    version: "2023_oficial_final"
  },
  {
    name: "Diseño Curricular del Nivel Primario, Primer Ciclo",
    url: "https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo/MusI-diseno-curricular-del-nivel-primario-primer-ciclopdf.pdf",
    institucion: "MINERD",
    nivel: "Primario",
    ciclo: "1.er Ciclo",
    grado: "1.º, 2.º y 3.º de Primaria",
    area: "Todas las áreas",
    anio: 2016,
    version: "2016_version_revisada"
  },
  {
    name: "Diseño Curricular del Nivel Primario, Segundo Ciclo",
    url: "https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo/gZol-diseno-curricular-del-nivel-primario-segundo-ciclopdf.pdf",
    institucion: "MINERD",
    nivel: "Primario",
    ciclo: "2.º Ciclo",
    grado: "4.º, 5.º y 6.º de Primaria",
    area: "Todas las áreas",
    anio: 2016,
    version: "2016_version_revisada"
  },
  {
    name: "Diseño Curricular del Nivel Secundario, Primer Ciclo",
    url: "https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo/RtcE-diseno-curricular-del-nivel-secundario-primer-ciclopdf.pdf",
    institucion: "MINERD",
    nivel: "Secundario",
    ciclo: "1.er Ciclo",
    grado: "1.º, 2.º y 3.º de Secundaria",
    area: "Todas las áreas",
    anio: 2016,
    version: "2016_version_revisada"
  },
  {
    name: "Secundaria Segundo Ciclo (modalidad académica)",
    url: "https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo/An9x-secundaria-segundo-ciclo-modalidad-academicapdf.pdf",
    institucion: "MINERD",
    nivel: "Secundario",
    ciclo: "2.º Ciclo",
    grado: "4.º, 5.º y 6.º de Secundaria",
    area: "Modalidad Académica",
    anio: 2017,
    version: "2017_oficial"
  },
  {
    name: "Secundaria Segundo Ciclo (Salidas Optativas modalidad académica)",
    url: "https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo/qUyh-secundaria-segundo-ciclo-salidas-optativas-modalidad-academicapdf.pdf",
    institucion: "MINERD",
    nivel: "Secundario",
    ciclo: "2.º Ciclo",
    grado: "4.º, 5.º y 6.º de Secundaria",
    area: "Salidas Optativas",
    anio: 2017,
    version: "2017_oficial"
  },
  {
    name: "Componente académico Técnico Prof y Artes",
    url: "https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo/hp5g-componente-academico-tecnico-prof-y-artespdf.pdf",
    institucion: "MINERD",
    nivel: "Secundario",
    ciclo: "2.º Ciclo",
    grado: "4.º, 5.º y 6.º de Secundaria",
    area: "Técnico Profesional y Artes",
    anio: 2017,
    version: "2017_oficial"
  },
  {
    name: "Naturaleza de la Modalidad en ARTES",
    url: "https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo/5njv-naturaleza-de-la-modadidad-en-artes-web-1pdf.pdf",
    institucion: "MINERD",
    nivel: "Secundario",
    ciclo: "2.º Ciclo",
    grado: "4.º, 5.º y 6.º de Secundaria",
    area: "Modalidad en Artes",
    anio: 2020,
    version: "2020_oficial"
  },
  {
    name: "Naturaleza de las Áreas Curriculares",
    url: "https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo/2fPZ-naturaleza-de-las-areas-curriculares-2020-web-1pdf.pdf",
    institucion: "MINERD",
    nivel: "General",
    ciclo: "Todos los ciclos",
    grado: "Todos los grados",
    area: "Todas las 8 áreas curriculares",
    anio: 2020,
    version: "2020_oficial"
  },
  {
    name: "NIVEL INICIAL - Diseño Curricular Actualizado",
    url: "https://ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo/raHf-nivel-inicial-diseno-curricular-actualizado-webpdf.pdf",
    institucion: "MINERD",
    nivel: "Inicial",
    ciclo: "1.er y 2.º Ciclo",
    grado: "Maternal, Kínder, Pre-primario",
    area: "Todas las dimensiones",
    anio: 2020,
    version: "2020_actualizado"
  }
];

async function inspectDoc(doc) {
  process.stdout.write(`[PROBANDO] ${doc.name}... `);
  try {
    const res = await fetch(doc.url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
    });

    const status = res.status;
    const contentType = res.headers.get("content-type") || "unknown";

    if (!res.ok) {
      console.log(`ERROR HTTP ${status}`);
      return { ...doc, status, contentType, error: `HTTP ${status}` };
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const parser = new PDFParse({ data: buffer });
    await parser.load();
    const info = await parser.getInfo();
    const result = await parser.getText();

    const totalPages = result.total || 0;
    const page1Raw = result.pages?.[0]?.text || "";
    const page1Clean = page1Raw.replace(/\r?\n+/g, " ").trim();
    const isScan = page1Clean.length < 25;

    console.log(`OK: ${totalPages} págs, OCR=${isScan ? "SÍ" : "NO"}`);

    return {
      name: doc.name,
      url: doc.url,
      institucion: doc.institucion,
      nivel: doc.nivel,
      ciclo: doc.ciclo,
      grado: doc.grado,
      area: doc.area,
      status,
      contentType,
      totalPages,
      title: info.title || doc.name,
      page1Text: page1Clean.substring(0, 160),
      isScan,
      requiresOCR: isScan,
      anio: doc.anio,
      version: doc.version
    };
  } catch (err) {
    console.log(`FALLÓ: ${err.message}`);
    return { ...doc, error: err.message };
  }
}

async function run() {
  const results = [];
  for (const doc of documents) {
    results.push(await inspectDoc(doc));
  }
  fs.writeFileSync(
    new URL("../scripts/inventory_verification.json", import.meta.url),
    JSON.stringify(results, null, 2),
    "utf-8"
  );
  console.log("\nResultados completos guardados en scripts/inventory_verification.json");
}

run();
