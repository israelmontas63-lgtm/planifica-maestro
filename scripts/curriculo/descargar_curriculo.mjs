/**
 * scripts/curriculo/descargar_curriculo.mjs
 * 
 * Automatización de recopilación y catalogación de documentos curriculares oficiales MINERD.
 * Node.js nativo (fetch, fs/promises, crypto, stream). Cero dependencias nuevas.
 * 
 * Reglas del Dueño:
 * R1. Dominios permitidos: ministeriodeeducacion.gob.do y minerd.gob.do.
 * R2. Respeta robots.txt. User-Agent: PlanificaMaestro-Recopilador/1.0. Sin evasión de bloqueos.
 * R3. 1 petición cada 1200 ms, un solo hilo. Timeout 30 s sin datos. 2 reintentos para 429/503.
 * R4. Número de ordenanza, año y vigencia: solo si constan en el texto; si no, NO CONSTA.
 * R5. No inventar nada. Cero credenciales.
 */

import fs from "node:fs";
import { promises as fsPromises } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";

const USER_AGENT = "PlanificaMaestro-Recopilador/1.0";
const INTERVALO_MS = 1200;
const TIMEOUT_MS = 30000;
const DIR_SALIDA = path.resolve(process.cwd(), "server/curriculo/fuentes");
const ARCHIVO_MANIFIESTO = path.join(DIR_SALIDA, "manifiesto.json");

// Catálogo maestro de documentos curriculares y registros oficiales
export const CATALOGO_DOCUMENTOS = [
  // 1. Núcleo Curricular Oficial
  {
    id: "adecuacion_primaria_2023_lq58",
    url: "https://www.ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo/lq58-adecuacion-curricular-primariapdf.pdf",
    tipo: "Adecuacion",
    nivel: "Primario",
    ciclo: "Ambos Ciclos",
    grado: "1.º a 6.º",
    area: "Todas las áreas",
    titulo_esperado: "ADECUACIÓN CURRICULAR NIVEL PRIMARIO",
    portada_esperada: "agosto 2022 / Santo Domingo 2023"
  },
  {
    id: "adecuacion_primaria_version_dPOb",
    url: "https://www.ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo/dPOb-adecuacion-curricular-del-nivel-primariopdf.pdf",
    tipo: "Adecuacion",
    nivel: "Primario",
    ciclo: "Ambos Ciclos",
    grado: "1.º a 6.º",
    area: "Todas las áreas",
    titulo_esperado: "ADECUACIÓN CURRICULAR DEL NIVEL PRIMARIO"
  },
  {
    id: "adecuacion_inicial_2023_1Z1p",
    url: "https://www.ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo/1Z1p-adecuacion-curricular-nivel-inicial-final-2023pdf.pdf",
    tipo: "Adecuacion",
    nivel: "Inicial",
    ciclo: "Primer y Segundo Ciclo",
    grado: "Maternal a Pre-Primario",
    area: "Todas las dimensiones",
    titulo_esperado: "ADECUACIÓN CURRICULAR NIVEL INICIAL"
  },
  {
    id: "adecuacion_secundaria_2023_Ht7X",
    url: "https://www.ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo/Ht7X-adecuacion-secundaria-2023pdf.pdf",
    tipo: "Adecuacion",
    nivel: "Secundario",
    ciclo: "Ambos Ciclos",
    grado: "1.º a 6.º",
    area: "Todas las áreas",
    titulo_esperado: "ADECUACIÓN CURRICULAR NIVEL SECUNDARIO"
  },
  {
    id: "diseno_inicial_actualizado_raHf",
    url: "https://www.ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo/raHf-nivel-inicial-diseno-curricular-actualizado-webpdf.pdf",
    tipo: "Diseno",
    nivel: "Inicial",
    ciclo: "Ambos Ciclos",
    grado: "45 días a 5 años",
    area: "Todas las dimensiones",
    titulo_esperado: "DISEÑO CURRICULAR NIVEL INICIAL"
  },
  {
    id: "diseno_primaria_primer_ciclo_MusI",
    url: "https://www.ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo/MusI-diseno-curricular-del-nivel-primario-primer-ciclopdf.pdf",
    tipo: "Diseno",
    nivel: "Primario",
    ciclo: "Primer Ciclo",
    grado: "1.º, 2.º y 3.º",
    area: "Todas las áreas",
    titulo_esperado: "DISEÑO CURRICULAR DEL NIVEL PRIMARIO PRIMER CICLO"
  },
  {
    id: "diseno_primaria_segundo_ciclo_gZol",
    url: "https://www.ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo/gZol-diseno-curricular-del-nivel-primario-segundo-ciclopdf.pdf",
    tipo: "Diseno",
    nivel: "Primario",
    ciclo: "Segundo Ciclo",
    grado: "4.º, 5.º y 6.º",
    area: "Todas las áreas",
    titulo_esperado: "DISEÑO CURRICULAR DEL NIVEL PRIMARIO SEGUNDO CICLO"
  },
  {
    id: "diseno_secundaria_primer_ciclo_RtcE",
    url: "https://www.ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo/RtcE-diseno-curricular-del-nivel-secundario-primer-ciclopdf.pdf",
    tipo: "Diseno",
    nivel: "Secundario",
    ciclo: "Primer Ciclo",
    grado: "1.º, 2.º y 3.º",
    area: "Todas las áreas",
    titulo_esperado: "DISEÑO CURRICULAR DEL NIVEL SECUNDARIO PRIMER CICLO"
  },

  // 2. Ordenanzas Oficiales Normativas
  {
    id: "ordenanza_01_2015_inicial_JYlV",
    url: "https://www.ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo/JYlV-ordenanza-01-2015-diseno-curricular-del-nivel-inicialpdf.pdf",
    tipo: "Ordenanza",
    nivel: "Inicial",
    ciclo: "Ambos Ciclos",
    grado: "Todos",
    area: "General",
    numero_ordenanza_propuesta: "01-2015"
  },
  {
    id: "ordenanza_02_2015_primaria_MVN1",
    url: "https://www.ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo/MVN1-ordenanza-no02-2015-diseno-curricular-del-nivel-primario-primer-ciclopdf.pdf",
    tipo: "Ordenanza",
    nivel: "Primario",
    ciclo: "Primer Ciclo",
    grado: "1.º a 3.º",
    area: "General",
    numero_ordenanza_propuesta: "02-2015"
  },
  {
    id: "ordenanza_03_2013_bases_CtKA",
    url: "https://www.ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo/CtKA-ordenanza-03-2013-bases-de-la-revision-y-actualizacion-curricularpdf.pdf",
    tipo: "Ordenanza",
    nivel: "General",
    ciclo: "Todos",
    grado: "Todos",
    area: "General",
    numero_ordenanza_propuesta: "03-2013"
  },

  // 3. Registros de Secundaria con nombre completo oficial
  {
    id: "registro_secundaria_1ro_rbjE",
    url: "https://www.ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo/rbjE-registro-1er-grado-sec-generalpdf.pdf",
    tipo: "Registro",
    nivel: "Secundario",
    ciclo: "Primer Ciclo",
    grado: "1.º Grado",
    area: "Registro de Grado"
  },
  {
    id: "registro_secundaria_2do_i8Wa",
    url: "https://www.ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo/i8Wa-registro-2do-grado-sec-generalpdf.pdf",
    tipo: "Registro",
    nivel: "Secundario",
    ciclo: "Primer Ciclo",
    grado: "2.º Grado",
    area: "Registro de Grado"
  },
  {
    id: "registro_secundaria_3ro_oajE",
    url: "https://www.ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo/oajE-registro-3er-grado-sec-generalpdf.pdf",
    tipo: "Registro",
    nivel: "Secundario",
    ciclo: "Primer Ciclo",
    grado: "3.er Grado",
    area: "Registro de Grado"
  },
  {
    id: "registro_secundaria_4to_T5r8",
    url: "https://www.ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo/T5r8-registro-4to-grado-sec-academicapdf.pdf",
    tipo: "Registro",
    nivel: "Secundario",
    ciclo: "Segundo Ciclo",
    grado: "4.to Grado",
    area: "Modalidad Académica"
  },
  {
    id: "registro_secundaria_5to_8Ny5",
    url: "https://www.ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo/8Ny5-registro-5to-grado-sec-academicapdf.pdf",
    tipo: "Registro",
    nivel: "Secundario",
    ciclo: "Segundo Ciclo",
    grado: "5.to Grado",
    area: "Modalidad Académica"
  },
  {
    id: "registro_secundaria_6to_8KXH",
    url: "https://www.ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo/8KXH-registro-6to-grado-sec-academicapdf.pdf",
    tipo: "Registro",
    nivel: "Secundario",
    ciclo: "Segundo Ciclo",
    grado: "6.to Grado",
    area: "Modalidad Académica"
  },

  // 4. Registros de Primaria con nombre completo oficial
  {
    id: "registro_primaria_1ro_Pl87",
    url: "https://www.ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo/Pl87-registro-1er-grado-nivel-primariopdf.pdf",
    tipo: "Registro",
    nivel: "Primario",
    ciclo: "Primer Ciclo",
    grado: "1.º Grado",
    area: "Registro de Grado"
  },
  {
    id: "registro_primaria_2do_s1jM",
    url: "https://www.ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo/s1jM-registro-2do-grado-nivel-primariopdf.pdf",
    tipo: "Registro",
    nivel: "Primario",
    ciclo: "Primer Ciclo",
    grado: "2.º Grado",
    area: "Registro de Grado"
  },
  {
    id: "registro_primaria_3ro_lHCB",
    url: "https://www.ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo/lHCB-registro-3er-grado-nivel-primariopdf.pdf",
    tipo: "Registro",
    nivel: "Primario",
    ciclo: "Primer Ciclo",
    grado: "3.er Grado",
    area: "Registro de Grado"
  },
  {
    id: "registro_primaria_4to_oLbB",
    url: "https://www.ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo/oLbB-registro-4to-grado-nivel-primariopdf.pdf",
    tipo: "Registro",
    nivel: "Primario",
    ciclo: "Segundo Ciclo",
    grado: "4.to Grado",
    area: "Registro de Grado"
  },
  {
    id: "registro_primaria_5to_BzXx",
    url: "https://www.ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo/BzXx-registro-5to-grado-nivel-primariopdf.pdf",
    tipo: "Registro",
    nivel: "Primario",
    ciclo: "Segundo Ciclo",
    grado: "5.to Grado",
    area: "Registro de Grado"
  },
  {
    id: "registro_primaria_6to_7Ov3",
    url: "https://www.ministeriodeeducacion.gob.do/docs/direccion-general-de-curriculo/7Ov3-registro-6to-grado-nivel-primariopdf.pdf",
    tipo: "Registro",
    nivel: "Primario",
    ciclo: "Segundo Ciclo",
    grado: "6.to Grado",
    area: "Registro de Grado"
  },

  // 5. Rutas tentativas bajo dirección general secundaria (para reportar 404 exacto sin invención)
  {
    id: "registro_secundaria_1ro_mRRi_tentativo",
    url: "https://www.ministeriodeeducacion.gob.do/docs/direccion-general-de-educacion-secundaria/mRRi-registro-de-grado-secundaria-primer-ciclo-1er-gradopdf.pdf",
    tipo: "Registro",
    nivel: "Secundario",
    ciclo: "Primer Ciclo",
    grado: "1.º Grado",
    area: "Registro de Grado"
  },
  {
    id: "registro_secundaria_2do_eDwT_tentativo",
    url: "https://www.ministeriodeeducacion.gob.do/docs/direccion-general-de-educacion-secundaria/eDwT-registro-de-grado-secundaria-primer-ciclo-2do-gradopdf.pdf",
    tipo: "Registro",
    nivel: "Secundario",
    ciclo: "Primer Ciclo",
    grado: "2.º Grado",
    area: "Registro de Grado"
  },
  {
    id: "registro_secundaria_3ro_BOnO_tentativo",
    url: "https://www.ministeriodeeducacion.gob.do/docs/direccion-general-de-educacion-secundaria/BOnO-registro-de-grado-secundaria-primer-ciclo-3er-gradopdf.pdf",
    tipo: "Registro",
    nivel: "Secundario",
    ciclo: "Primer Ciclo",
    grado: "3.er Grado",
    area: "Registro de Grado"
  },
  {
    id: "registro_secundaria_4to_YfOB_tentativo",
    url: "https://www.ministeriodeeducacion.gob.do/docs/direccion-general-de-educacion-secundaria/YfOB-registro-de-grado-secundaria-segundo-ciclo-4to-gradopdf.pdf",
    tipo: "Registro",
    nivel: "Secundario",
    ciclo: "Segundo Ciclo",
    grado: "4.to Grado",
    area: "Registro de Grado"
  },
  {
    id: "registro_secundaria_5to_Q0KS_tentativo",
    url: "https://www.ministeriodeeducacion.gob.do/docs/direccion-general-de-educacion-secundaria/Q0KS-registro-de-grado-secundaria-segundo-ciclo-5to-gradopdf.pdf",
    tipo: "Registro",
    nivel: "Secundario",
    ciclo: "Segundo Ciclo",
    grado: "5.to Grado",
    area: "Registro de Grado"
  },
  {
    id: "registro_secundaria_6to_k3jO_tentativo",
    url: "https://www.ministeriodeeducacion.gob.do/docs/direccion-general-de-educacion-secundaria/k3jO-registro-de-grado-secundaria-segundo-ciclo-6to-gradopdf.pdf",
    tipo: "Registro",
    nivel: "Secundario",
    ciclo: "Segundo Ciclo",
    grado: "6.to Grado",
    area: "Registro de Grado"
  }
];

export async function consultarRobotsTxt() {
  try {
    const res = await fetch("https://www.ministeriodeeducacion.gob.do/robots.txt", {
      headers: { "User-Agent": USER_AGENT }
    });
    const txt = await res.text();
    return { ok: true, status: res.status, contenido: txt.trim() };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function verificarUrl(item, reintentos = 2) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(item.url, {
      method: "HEAD",
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if ((res.status === 429 || res.status === 503) && reintentos > 0) {
      const waitSec = parseInt(res.headers.get("retry-after") || "2", 10);
      await sleep(waitSec * 1000);
      return verificarUrl(item, reintentos - 1);
    }

    return {
      id: item.id,
      url_origen: item.url,
      url_final: res.url || item.url,
      http_estado: res.status,
      content_type: res.headers.get("content-type") || "NO CONSTA",
      tamano_bytes: res.headers.get("content-length") ? parseInt(res.headers.get("content-length"), 10) : "NO CONSTA",
      tipo: item.tipo,
      nivel: item.nivel || "NO CONSTA",
      ciclo: item.ciclo || "NO CONSTA",
      grado: item.grado || "NO CONSTA",
      area: item.area || "NO CONSTA",
      ok: res.ok,
      estado: res.ok ? "VERIFICADO" : "NO_DESCARGADO",
      motivo: res.ok ? null : `HTTP_${res.status}`
    };
  } catch (err) {
    clearTimeout(timeoutId);
    return {
      id: item.id,
      url_origen: item.url,
      url_final: item.url,
      http_estado: "ERROR",
      tipo: item.tipo,
      nivel: item.nivel || "NO CONSTA",
      ok: false,
      estado: "NO_DESCARGADO",
      motivo: err.name === "AbortError" ? "TIMEOUT_30S" : err.message
    };
  }
}

async function ejecutarModoVerificar() {
  console.log("========================================================================");
  console.log("FASE 1: VERIFICACIÓN DE URLs OFICIALES MINERD (SIN GUARDAR/DESCARGAR)");
  console.log("========================================================================\n");

  const robots = await consultarRobotsTxt();
  console.log("ROBOTS.TXT:");
  console.log(robots.ok ? robots.contenido : `ERROR: ${robots.error}`);
  console.log("\nIniciando verificación (1 petición cada 1200 ms, User-Agent honesto)...\n");

  const resultados = [];
  for (let i = 0; i < CATALOGO_DOCUMENTOS.length; i++) {
    const doc = CATALOGO_DOCUMENTOS[i];
    console.log(`[${i + 1}/${CATALOGO_DOCUMENTOS.length}] Verificando: ${doc.url}`);
    const res = await verificarUrl(doc);
    console.log(`   -> HTTP ${res.http_estado} | Tipo: ${res.content_type} | Tamaño: ${res.tamano_bytes}`);
    resultados.push(res);
    await sleep(INTERVALO_MS);
  }

  const activas = resultados.filter((r) => r.ok);
  const fallidas = resultados.filter((r) => !r.ok);

  console.log("\n========================================================================");
  console.log(`TOTAL VERIFICADAS: ${resultados.length}`);
  console.log(`ACTIVAS (HTTP 200): ${activas.length}`);
  console.log(`NO DISPONIBLES: ${fallidas.length}`);
  console.log("========================================================================");

  return { resultados, activas, fallidas };
}

// Ejecución directa
const args = process.argv.slice(2);
if (args.includes("--verificar") || args.length === 0) {
  ejecutarModoVerificar().catch(console.error);
}
