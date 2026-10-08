/**
 * tests/correr_casos_especificos.mjs
 * 
 * Re-ejecuta exactamente 5 corridas para los Casos 2, 4, 10 y 14 (Regla 3C.4)
 * Timeout estricto de 30s, guardado en tests/resultados_casos_2_4_10_14.json
 */

import fs from "node:fs";
import path from "node:path";
import { CONVERSACIONES_REFERENCIA, responderCaso } from "./conducta_asistente.mjs";

const ARCHIVO_SALIDA = path.resolve(process.cwd(), "tests/resultados_casos_2_4_10_14.json");
const CASOS_IDS = [2, 4, 10, 14];
const NUM_CORRIDAS = 5;

async function correrCasos() {
  console.log(`=== RE-CORRIENDO CASOS 2, 4, 10 y 14 (${NUM_CORRIDAS} corridas c/u) ===`);
  const resultados = {};

  for (const id of CASOS_IDS) {
    const caso = CONVERSACIONES_REFERENCIA.find((c) => c.id === id);
    resultados[id] = {
      id: caso.id,
      titulo: caso.titulo,
      principio: caso.principio,
      corridas: []
    };

    console.log(`\n--- Caso ${caso.id}: "${caso.titulo}" ---`);
    for (let c = 1; c <= NUM_CORRIDAS; c++) {
      process.stdout.write(`[Caso ${caso.id}] Corrida ${c}/${NUM_CORRIDAS}... `);
      const start = Date.now();
      try {
        const resp = await Promise.race([
          responderCaso(caso),
          new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT_30S")), 30000))
        ]);

        const cumple = caso.evaluar(resp.texto);
        const resultadoItem = {
          corrida: c,
          cumple,
          ms: resp.ms || (Date.now() - start),
          proveedor: resp.proveedor,
          extracto: resp.texto.substring(0, 140).replace(/\r?\n/g, " "),
          textoCompleto: resp.texto
        };
        resultados[id].corridas.push(resultadoItem);
        fs.writeFileSync(ARCHIVO_SALIDA, JSON.stringify(resultados, null, 2), "utf8");

        if (cumple) {
          console.log(`✔ CUMPLE (${resultadoItem.ms}ms)`);
        } else {
          console.log(`❌ NO CUMPLE (${resultadoItem.ms}ms)`);
        }
      } catch (err) {
        console.log(`⚠️ FALLO: ${err.message}`);
        resultados[id].corridas.push({
          corrida: c,
          cumple: false,
          ms: Date.now() - start,
          error: err.message
        });
        fs.writeFileSync(ARCHIVO_SALIDA, JSON.stringify(resultados, null, 2), "utf8");
      }
      await new Promise((r) => setTimeout(r, 1200));
    }
  }

  console.log("\n========================================================");
  console.log("RESUMEN DE RE-CORRIDA (CASOS 2, 4, 10, 14):");
  for (const id of CASOS_IDS) {
    const item = resultados[id];
    const aciertos = item.corridas.filter((x) => x.cumple).length;
    const pct = Math.round((aciertos / NUM_CORRIDAS) * 100);
    console.log(`- Caso ${id} (${item.titulo}): ${aciertos}/${NUM_CORRIDAS} (${pct}%)`);
  }
  console.log("========================================================\n");
}

correrCasos().catch(console.error);
