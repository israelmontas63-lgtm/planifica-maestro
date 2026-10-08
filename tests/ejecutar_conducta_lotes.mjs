/**
 * tests/ejecutar_conducta_lotes.mjs
 * 
 * Ejecuta pruebas de conducta del asistente pedagógico en lotes pequeños con:
 * - Timeout estricto de 30 segundos por llamada (AbortSignal.timeout(30000)).
 * - Guardado progresivo en tests/resultados_conducta.json tras cada llamada.
 * - Detección y reporte inmediato de 429 / cuota.
 * - Soporte para especificar --desde <num> --hasta <num> --corridas <num>.
 */

import fs from "node:fs";
import path from "node:path";
import { CONVERSACIONES_REFERENCIA, responderCaso } from "./conducta_asistente.mjs";

const devVarsPath = path.resolve(process.cwd(), ".dev.vars");
const env = {};
if (fs.existsSync(devVarsPath)) {
  const lines = fs.readFileSync(devVarsPath, "utf8").split("\n");
  for (const line of lines) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

const apiKey = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("❌ No se encontró GEMINI_API_KEY");
  process.exit(1);
}

const model = process.env.GEMINI_MODEL || env.GEMINI_MODEL || "gemini-3.1-flash-lite";

// Argumentos CLI
function obtenerArg(nombre, defecto) {
  const idx = process.argv.indexOf(nombre);
  if (idx !== -1 && process.argv[idx + 1]) {
    return parseInt(process.argv[idx + 1], 10);
  }
  return defecto;
}

const DESDE = obtenerArg("--desde", 1);
const HASTA = obtenerArg("--hasta", 15);
const CORRIDAS = obtenerArg("--corridas", 3);
const ARCHIVO_RESULTADOS = path.resolve(process.cwd(), "tests/resultados_conducta.json");

// Cargar resultados existentes o inicializar
let baseResultados = {};
if (fs.existsSync(ARCHIVO_RESULTADOS)) {
  try {
    baseResultados = JSON.parse(fs.readFileSync(ARCHIVO_RESULTADOS, "utf8"));
  } catch (e) {
    baseResultados = {};
  }
}

async function ejecutarLote() {
  console.log(`=== EJECUTANDO LOTE: Casos ${DESDE} a ${HASTA} (${CORRIDAS} corridas c/u) ===`);
  console.log(`Modelo: ${model} | Timeout: 30s por llamada | Archivo: tests/resultados_conducta.json\n`);

  const casosFiltrados = CONVERSACIONES_REFERENCIA.filter((c) => c.id >= DESDE && c.id <= HASTA);
  let llamadasRealizadas = 0;

  for (const c of casosFiltrados) {
    if (!baseResultados[c.id]) {
      baseResultados[c.id] = {
        id: c.id,
        titulo: c.titulo,
        principio: c.principio,
        esperado: c.esperado,
        corridas: []
      };
    }

    // Correr las iteraciones faltantes para este caso hasta alcanzar CORRIDAS
    while (baseResultados[c.id].corridas.length < CORRIDAS) {
      const numCorrida = baseResultados[c.id].corridas.length + 1;
      process.stdout.write(`[Caso ${c.id} - Corrida ${numCorrida}/${CORRIDAS}] "${c.titulo.substring(0, 30)}"... `);
      llamadasRealizadas++;

      const start = Date.now();
      try {
        const respuesta = await Promise.race([
          responderCaso(c),
          new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT_30S")), 30000))
        ]);

        const cumple = c.evaluar(respuesta.texto);
        const resultadoCorrida = {
          corrida: numCorrida,
          cumple,
          ms: respuesta.ms || (Date.now() - start),
          proveedor: respuesta.proveedor,
          extracto: respuesta.texto.substring(0, 120).replace(/\r?\n/g, " "),
          textoCompleto: respuesta.texto
        };

        baseResultados[c.id].corridas.push(resultadoCorrida);
        fs.writeFileSync(ARCHIVO_RESULTADOS, JSON.stringify(baseResultados, null, 2), "utf8");

        if (cumple) {
          console.log(`✔ CUMPLE (${resultadoCorrida.ms}ms) [${resultadoCorrida.proveedor}]`);
        } else {
          console.log(`❌ NO CUMPLE (${resultadoCorrida.ms}ms)`);
        }
      } catch (err) {
        const es429 = err.message.includes("429") || err.message.includes("quota");
        const resultadoFalla = {
          corrida: numCorrida,
          cumple: false,
          ms: Date.now() - start,
          error: err.message,
          es429
        };
        baseResultados[c.id].corridas.push(resultadoFalla);
        fs.writeFileSync(ARCHIVO_RESULTADOS, JSON.stringify(baseResultados, null, 2), "utf8");

        console.log(`⚠️ ERROR: ${err.message}`);
        if (es429) {
          console.error(`🚨 ERROR DE CUOTA 429 DETECTADO en ${model}. Total llamadas en sesión: ${llamadasRealizadas}. Deteniendo lote.`);
          process.exit(2);
        }
      }

      // Pausa prudente para no saturar rate limit
      await new Promise((r) => setTimeout(r, 1200));
    }
  }

  console.log(`\n✔ LOTE ${DESDE}-${HASTA} FINALIZADO. Resultados guardados en ${ARCHIVO_RESULTADOS}`);
}

ejecutarLote().catch((err) => {
  console.error("Error fatal en lote:", err);
  process.exit(1);
});
