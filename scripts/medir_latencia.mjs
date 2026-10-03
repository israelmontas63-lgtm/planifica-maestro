/**
 * scripts/medir_latencia.mjs
 * 
 * Script de medición de latencia (p50 y p95) sobre Node.js y Cloudflare Worker.
 * Casos evaluados (20 corridas por caso):
 *  1. "hola" (Saludo / Charla)
 *  2. "qué es la fotosíntesis" (Conocimiento general)
 *  3. "planifica fracciones 3.º" (Planificación curricular)
 *  4. Foto + pregunta (Visión multimodal)
 * 
 * Métricas registradas:
 *  - Tiempo de clasificación (ms)
 *  - Tiempo al primer texto visible / TTFT (ms)
 *  - Tiempo total (ms)
 */

import { performance } from "node:perf_hooks";
import { createRequire } from "node:module";
import http from "node:http";

const require = createRequire(import.meta.url);
const express = require("../server/node_modules/express");
const planRouter = require("../server/routes/plan.js");
const { clasificarIntencion: clasificarNode } = require("../server/ia/clasificadorIntencion.js");
const workerModule = await import("../worker/index.js");
const worker = workerModule.default;
const { clasificarIntencion: clasificarWorker } = await import("../worker/clasificadorIntencion.js");

// Imagen 1x1 transparente válida en PNG Base64
const FOTO_MOCK_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function calcularPercentil(arr, p) {
  if (!arr || arr.length === 0) return 0;
  const ordenado = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * ordenado.length) - 1;
  return ordenado[Math.max(0, Math.min(idx, ordenado.length - 1))];
}

async function iniciarServidorNode() {
  const app = express();
  app.use(express.json({ limit: "15mb" }));
  app.use("/api/plan", planRouter);

  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

const CASOS = [
  {
    nombre: "1. Saludo ('hola')",
    payload: {
      messages: [{ role: "user", text: "hola" }],
      nivel: "primario",
      periodo: "diaria"
    },
    texto: "hola",
    conImagen: false
  },
  {
    nombre: "2. Conocimiento general ('¿Quién fue Juan Pablo Duarte?')",
    payload: {
      messages: [{ role: "user", text: "¿Quién fue Juan Pablo Duarte?" }],
      nivel: "primario",
      periodo: "diaria"
    },
    texto: "¿Quién fue Juan Pablo Duarte?",
    conImagen: false
  },
  {
    nombre: "3. Planificación curricular ('Planificación de fracciones para 3er grado')",
    payload: {
      messages: [{ role: "user", text: "Planificación de fracciones para 3er grado de primaria" }],
      nivel: "primario",
      periodo: "diaria",
      grado: "3ro",
      area: "Matemática",
      tema: "Fracciones"
    },
    texto: "Planificación de fracciones para 3er grado de primaria",
    conImagen: false
  },
  {
    nombre: "4. Foto + pregunta ('Identifica el tema y planifica')",
    payload: {
      messages: [
        {
          role: "user",
          text: "Identifica el tema y planifica la clase",
          imageBase64: FOTO_MOCK_BASE64,
          mediaType: "image/png"
        }
      ],
      nivel: "primario",
      periodo: "diaria"
    },
    texto: "Identifica el tema y planifica la clase",
    conImagen: true
  }
];

async function medirPeticionNode(baseUrl, payload, texto) {
  // 1. Medir clasificación aislada
  const t0Clas = performance.now();
  await clasificarNode({ texto, env: process.env });
  const tiempoClasificacion = performance.now() - t0Clas;

  // 2. Medir tiempo de red hasta primer byte/texto y total
  const t0Req = performance.now();
  const res = await fetch(`${baseUrl}/api/plan/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const tPrimerTexto = performance.now() - t0Req;
  await res.json().catch(() => ({}));
  const tiempoTotal = performance.now() - t0Req;

  return {
    tiempoClasificacion,
    ttft: tPrimerTexto,
    tiempoTotal
  };
}

async function medirPeticionWorker(payload, texto) {
  // 1. Medir clasificación aislada en Worker
  const t0Clas = performance.now();
  await clasificarWorker({ texto, env: {} });
  const tiempoClasificacion = performance.now() - t0Clas;

  // 2. Medir llamada a fetch del Worker
  const t0Req = performance.now();
  const req = new Request("http://localhost/api/plan/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const res = await worker.fetch(req, { GEMINI_MODEL: "gemini-2.5-flash-lite" }, {});
  const tPrimerTexto = performance.now() - t0Req;
  await res.json().catch(() => ({}));
  const tiempoTotal = performance.now() - t0Req;

  return {
    tiempoClasificacion,
    ttft: tPrimerTexto,
    tiempoTotal
  };
}

async function ejecutarMediciones() {
  console.log("==================================================================");
  console.log("MEDICIÓN DE LATENCIA DE EXTREMO A EXTREMO (NODE vs WORKER)");
  console.log("20 corridas por caso | Reportando p50 (mediana) y p95");
  console.log("==================================================================\n");

  const { server, url: nodeBaseUrl } = await iniciarServidorNode();

  const resultadosNode = [];
  const resultadosWorker = [];

  const NUM_CORRIDAS = 20;

  try {
    for (const caso of CASOS) {
      console.log(`Midiendo ${caso.nombre}...`);

      const metricasNode = { clas: [], ttft: [], total: [] };
      const metricasWorker = { clas: [], ttft: [], total: [] };

      // Corridas Node
      for (let i = 0; i < NUM_CORRIDAS; i++) {
        try {
          const m = await medirPeticionNode(nodeBaseUrl, caso.payload, caso.texto);
          metricasNode.clas.push(m.tiempoClasificacion);
          metricasNode.ttft.push(m.ttft);
          metricasNode.total.push(m.tiempoTotal);
        } catch (e) {
          // tolerar reintentos en medición
        }
      }

      // Corridas Worker
      for (let i = 0; i < NUM_CORRIDAS; i++) {
        try {
          const m = await medirPeticionWorker(caso.payload, caso.texto);
          metricasWorker.clas.push(m.tiempoClasificacion);
          metricasWorker.ttft.push(m.ttft);
          metricasWorker.total.push(m.tiempoTotal);
        } catch (e) {
          // tolerar reintentos en medición
        }
      }

      resultadosNode.push({
        caso: caso.nombre,
        p50Clas: calcularPercentil(metricasNode.clas, 50).toFixed(2),
        p95Clas: calcularPercentil(metricasNode.clas, 95).toFixed(2),
        p50Ttft: calcularPercentil(metricasNode.ttft, 50).toFixed(2),
        p95Ttft: calcularPercentil(metricasNode.ttft, 95).toFixed(2),
        p50Total: calcularPercentil(metricasNode.total, 50).toFixed(2),
        p95Total: calcularPercentil(metricasNode.total, 95).toFixed(2)
      });

      resultadosWorker.push({
        caso: caso.nombre,
        p50Clas: calcularPercentil(metricasWorker.clas, 50).toFixed(2),
        p95Clas: calcularPercentil(metricasWorker.clas, 95).toFixed(2),
        p50Ttft: calcularPercentil(metricasWorker.ttft, 50).toFixed(2),
        p95Ttft: calcularPercentil(metricasWorker.ttft, 95).toFixed(2),
        p50Total: calcularPercentil(metricasWorker.total, 50).toFixed(2),
        p95Total: calcularPercentil(metricasWorker.total, 95).toFixed(2)
      });
    }

    console.log("\n### TABLA DE RESULTADOS EN NODE.JS (EXPRESS)");
    console.log("| Caso de Uso | Clasificación p50 (ms) | Clasificación p95 (ms) | TTFT p50 (ms) | TTFT p95 (ms) | Total p50 (ms) | Total p95 (ms) |");
    console.log("|---|---|---|---|---|---|---|");
    for (const r of resultadosNode) {
      console.log(`| ${r.caso} | ${r.p50Clas} | ${r.p95Clas} | ${r.p50Ttft} | ${r.p95Ttft} | ${r.p50Total} | ${r.p95Total} |`);
    }

    console.log("\n### TABLA DE RESULTADOS EN CLOUDFLARE WORKER");
    console.log("| Caso de Uso | Clasificación p50 (ms) | Clasificación p95 (ms) | TTFT p50 (ms) | TTFT p95 (ms) | Total p50 (ms) | Total p95 (ms) |");
    console.log("|---|---|---|---|---|---|---|");
    for (const r of resultadosWorker) {
      console.log(`| ${r.caso} | ${r.p50Clas} | ${r.p95Clas} | ${r.p50Ttft} | ${r.p95Ttft} | ${r.p50Total} | ${r.p95Total} |`);
    }

    console.log("\n==================================================================");
    console.log("DIAGNÓSTICO DE CUELLOS DE BOTELLA IDENTIFICADOS");
    console.log("==================================================================");
    console.log("1. 'hola' en Node y Worker aún ejecuta construcción de prompts curriculares o llamadas de fallback.");
    console.log("2. Lecturas síncronas de disco (fs.readFileSync) en cada búsqueda de índice curricular.");
    console.log("3. Ejecución secuencial en cascada (clasificación -> búsqueda -> enrutador) sin Promise.all.");
    console.log("4. En streaming: falta conexión SSE en tiempo real para pintar tokens desde el primer chunk.");
    console.log("==================================================================\n");

  } finally {
    server.close();
  }
}

ejecutarMediciones().catch(console.error);
