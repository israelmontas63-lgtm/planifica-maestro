/**
 * scripts/curriculo/generar_sql_secuencias.mjs
 * 
 * Generador offline de sentencias SQL para curriculo_secuencias a partir de curriculo_estructurado.json.
 * Cero fetch, cero acceso a claves de entorno o red.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

const jsonPath = path.resolve(repoRoot, "server/curriculo/capa3_estructurados/curriculo_estructurado.json");
const salidaDir = path.resolve(repoRoot, "scripts/curriculo/salida");
const sqlPath = path.resolve(salidaDir, "curriculo_secuencias_pendiente.sql");
const omitidosPath = path.resolve(salidaDir, "informe_omitidos.txt");

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");

if (!fs.existsSync(jsonPath)) {
  console.error(`[Error] No se encontró el archivo origen: ${jsonPath}`);
  process.exit(1);
}

const rawData = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
if (!Array.isArray(rawData)) {
  console.error(`[Error] curriculo_estructurado.json no es un arreglo.`);
  process.exit(1);
}

const omitidos = [];
const filasValidas = [];
const conteos = {};

function escapeSqlString(str) {
  if (str === null || str === undefined) return "NULL";
  return `'${String(str).replace(/'/g, "''")}'`;
}

let idxAreaGrado = {};

for (let i = 0; i < rawData.length; i++) {
  const item = rawData[i];
  const itemIdx = i + 1;

  // 1. Validar y normalizar Nivel
  let nivel = null;
  const nivelRaw = (item.nivel || "").toLowerCase();
  if (nivelRaw.includes("primar")) nivel = "Primario";
  else if (nivelRaw.includes("secundar")) nivel = "Secundario";
  else if (nivelRaw.includes("inic")) nivel = "Inicial";

  if (!nivel) {
    omitidos.push({ index: itemIdx, id: item.id, motivo: `Nivel inválido o no reconocido: "${item.nivel}"` });
    continue;
  }

  // 2. Grado
  let gradoNum = null;
  if (typeof item.grado_num === "number") {
    gradoNum = item.grado_num;
  } else if (typeof item.grado === "string") {
    const m = item.grado.match(/(\d+)/);
    if (m) gradoNum = parseInt(m[1], 10);
  }

  if (!gradoNum || gradoNum < 1 || gradoNum > 6) {
    omitidos.push({ index: itemIdx, id: item.id, motivo: `Grado fuera de rango 1..6: "${item.grado_num || item.grado}"` });
    continue;
  }

  // 3. Ciclo
  let ciclo = null;
  if (gradoNum >= 1 && gradoNum <= 3) ciclo = "Primer Ciclo";
  else if (gradoNum >= 4 && gradoNum <= 6) ciclo = "Segundo Ciclo";

  // CHECK chk_coherencia_primaria
  if (nivel === "Primario") {
    if (ciclo === "Primer Ciclo" && (gradoNum < 1 || gradoNum > 3)) {
      omitidos.push({ index: itemIdx, id: item.id, motivo: `Incoherencia ciclo/grado para Primaria: ${ciclo} grado ${gradoNum}` });
      continue;
    }
    if (ciclo === "Segundo Ciclo" && (gradoNum < 4 || gradoNum > 6)) {
      omitidos.push({ index: itemIdx, id: item.id, motivo: `Incoherencia ciclo/grado para Primaria: ${ciclo} grado ${gradoNum}` });
      continue;
    }
  }

  // 4. Área
  let area = item.area;
  if (!area || typeof area !== "string" || area.trim() === "") {
    omitidos.push({ index: itemIdx, id: item.id, motivo: `Área vacía o no definida` });
    continue;
  }
  area = area.trim();

  // 5. Tema
  let tema = item.tema;
  if (!tema || typeof tema !== "string" || tema.trim() === "") {
    omitidos.push({ index: itemIdx, id: item.id, motivo: `Tema vacío o no definido` });
    continue;
  }
  tema = tema.trim();

  // 6. Competencias Específicas (TEXT NOT NULL)
  let compEsp = null;
  if (Array.isArray(item.competencias_especificas)) {
    compEsp = item.competencias_especificas.filter(Boolean).map(s => s.trim()).join("\n");
  } else if (typeof item.competencias_especificas === "string") {
    compEsp = item.competencias_especificas.trim();
  }
  if (!compEsp) {
    omitidos.push({ index: itemIdx, id: item.id, motivo: `Competencias específicas vacías` });
    continue;
  }

  // 7. Indicadores de Logro (JSONB Array NOT NULL)
  let indLogro = null;
  if (Array.isArray(item.indicadores_logro)) {
    indLogro = item.indicadores_logro.filter(Boolean).map(s => s.trim());
  }
  if (!indLogro || indLogro.length === 0) {
    omitidos.push({ index: itemIdx, id: item.id, motivo: `Indicadores de logro vacíos o no es arreglo` });
    continue;
  }

  // 8. Contenidos Texto Original (TEXT)
  let contTexto = null;
  if (item.contenidos && typeof item.contenidos.texto_original === "string") {
    contTexto = item.contenidos.texto_original.trim();
  }

  // 9. Bloque Guía
  const bloqueGuia = item.bloque_guia ? String(item.bloque_guia).trim() : null;

  // 10. Fuente Documento & Versión
  const fuenteDoc = item.documento_fuente ? String(item.documento_fuente).trim() : "Guía Didáctica MINERD / CON BASE";
  const versionCurricular = "2023";

  // 11. Página (sin inventar: solo si existe en item.pagina_referencia o item.pagina)
  let pagina = null;
  if (item.pagina_referencia) {
    pagina = String(item.pagina_referencia).trim();
  } else if (item.pagina) {
    pagina = String(item.pagina).trim();
  }

  // 12. URL Fuente
  const urlFuente = item.url_fuente ? String(item.url_fuente).trim() : null;

  // 13. Source ID determinista
  let areaCode = "GEN";
  if (/lengua/i.test(area)) areaCode = "ESP";
  else if (/matem/i.test(area)) areaCode = "MAT";
  else if (/social/i.test(area)) areaCode = "SOC";
  else if (/natur/i.test(area)) areaCode = "NAT";

  const keyCont = `${nivel}-${gradoNum}-${areaCode}`;
  idxAreaGrado[keyCont] = (idxAreaGrado[keyCont] || 0) + 1;
  const seqNum = String(idxAreaGrado[keyCont]).padStart(3, "0");
  const sourceId = `SEC-PRI-${gradoNum}-${areaCode}-${seqNum}`;

  // 14. Huella SHA-256 canónica
  const contenidoCanonico = `${nivel}|${gradoNum}|${area}|${tema}|${compEsp}|${indLogro.join(";")}|${contTexto || ""}`;
  const huella = crypto.createHash("sha256").update(contenidoCanonico, "utf8").digest("hex");

  filasValidas.push({
    source_id: sourceId,
    nivel,
    ciclo,
    grado_num: gradoNum,
    area,
    tema,
    bloque_guia: bloqueGuia,
    competencias_especificas: compEsp,
    contenidos_texto_original: contTexto,
    indicadores_logro: JSON.stringify(indLogro),
    fuente_documento: fuenteDoc,
    version_curricular: versionCurricular,
    pagina,
    url_fuente: urlFuente,
    estado_validacion: "pendiente_validacion",
    huella
  });

  const k = `${nivel} | ${gradoNum}.° Grado | ${area}`;
  conteos[k] = (conteos[k] || 0) + 1;
}

console.log("================================================================================");
console.log("GENERADOR DE SQL DE SECUENCIAS CURRICULARES (OFFLINE)");
console.log("================================================================================");
console.log(`Total registros en JSON: ${rawData.length}`);
console.log(`Filas válidas generadas: ${filasValidas.length}`);
console.log(`Filas omitidas:          ${omitidos.length}`);
console.log("--------------------------------------------------------------------------------");
console.log("Distribución de secuencias válidas por nivel / grado / área:");
for (const [k, v] of Object.entries(conteos)) {
  console.log(`  * ${k}: ${v} secuencias`);
}

if (omitidos.length > 0) {
  console.log("--------------------------------------------------------------------------------");
  console.log("Motivos de omisión:");
  const motivosCount = {};
  omitidos.forEach(o => {
    motivosCount[o.motivo] = (motivosCount[o.motivo] || 0) + 1;
  });
  for (const [m, count] of Object.entries(motivosCount)) {
    console.log(`  * ${m}: ${count}`);
  }
}
console.log("================================================================================");

if (isDryRun) {
  console.log("[DRY-RUN] Modo simulación completado. No se escribieron archivos en disco.");
  process.exit(0);
}

if (!fs.existsSync(salidaDir)) {
  fs.mkdirSync(salidaDir, { recursive: true });
}

// Escribir informe de omitidos
let txtOmitidos = `INFORME DE REGISTROS OMITIDOS\nGenerado: ${new Date().toISOString()}\nTotal omitidos: ${omitidos.length}\n\n`;
omitidos.forEach(o => {
  txtOmitidos += `Registro #${o.index} (id: ${o.id || "N/A"}): ${o.motivo}\n`;
});
fs.writeFileSync(omitidosPath, txtOmitidos, "utf8");

// Generar SQL
let sql = `-- =============================================================================\n`;
sql += `-- NO EJECUTAR EN PRODUCCIÓN: filas pendiente_validacion, requieren verificación de tomo y página\n`;
sql += `-- Generado automáticamente por scripts/curriculo/generar_sql_secuencias.mjs\n`;
sql += `-- Total filas: ${filasValidas.length}\n`;
sql += `-- =============================================================================\n\n`;

for (const f of filasValidas) {
  sql += `INSERT INTO public.curriculo_secuencias (\n`;
  sql += `    source_id, nivel, ciclo, grado_num, area, tema, bloque_guia,\n`;
  sql += `    competencias_especificas, contenidos_texto_original, indicadores_logro,\n`;
  sql += `    fuente_documento, version_curricular, pagina, url_fuente,\n`;
  sql += `    estado_validacion, vigente, huella\n`;
  sql += `) VALUES (\n`;
  sql += `    ${escapeSqlString(f.source_id)},\n`;
  sql += `    ${escapeSqlString(f.nivel)},\n`;
  sql += `    ${escapeSqlString(f.ciclo)},\n`;
  sql += `    ${f.grado_num},\n`;
  sql += `    ${escapeSqlString(f.area)},\n`;
  sql += `    ${escapeSqlString(f.tema)},\n`;
  sql += `    ${escapeSqlString(f.bloque_guia)},\n`;
  sql += `    ${escapeSqlString(f.competencias_especificas)},\n`;
  sql += `    ${escapeSqlString(f.contenidos_texto_original)},\n`;
  sql += `    ${escapeSqlString(f.indicadores_logro)}::jsonb,\n`;
  sql += `    ${escapeSqlString(f.fuente_documento)},\n`;
  sql += `    ${escapeSqlString(f.version_curricular)},\n`;
  sql += `    ${escapeSqlString(f.pagina)},\n`;
  sql += `    ${escapeSqlString(f.url_fuente)},\n`;
  sql += `    ${escapeSqlString(f.estado_validacion)},\n`;
  sql += `    true,\n`;
  sql += `    ${escapeSqlString(f.huella)}\n`;
  sql += `) ON CONFLICT (source_id) DO NOTHING;\n\n`;
}

fs.writeFileSync(sqlPath, sql, "utf8");
console.log(`[Éxito] SQL escrito en: ${sqlPath}`);
console.log(`[Éxito] Informe de omitidos en: ${omitidosPath}`);
