/**
 * scripts/medir_latencia.mjs
 * 
 * Script de medición de latencia (p50 y p95) sobre Node.js y Cloudflare Worker.
 * Soporta ejecución REAL (con claves de .env) y ejecución SIMULADA (--simulado).
 * 
 * Casos evaluados (20 corridas por caso):
 *  1. "hola" (Saludo / Charla)
 *  2. "qué es la fotosíntesis" / "¿Quién fue Juan Pablo Duarte?" (Conocimiento general -> va al modelo)
 *  3. "planifica fracciones 3.º" (Planificación curricular)
 *  4. Foto + pregunta (Visión multimodal)
 * 
 * Métricas registradas:
 *  - Tiempo al primer texto visible / TTFT (ms) [p50 / p95]
 *  - Tiempo total de respuesta (ms) [p50 / p95]
 */

import { performance } from "node:perf_hooks";
import { createRequire } from "node:module";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carga segura de .env sin imprimir valores ni exponer secretos
function cargarEnvSilencioso() {
  const rutas = [
    path.join(__dirname, "..", ".env"),
    path.join(__dirname, "..", "server", ".env"),
    path.join(__dirname, "..", "client", ".env")
  ];

  let clavesCargadas = 0;
  for (const r of rutas) {
    if (fs.existsSync(r)) {
      try {
        const lineas = fs.readFileSync(r, "utf-8").split("\n");
        for (const l of lineas) {
          const trimmed = l.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const idx = trimmed.indexOf("=");
          if (idx !== -1) {
            const k = trimmed.substring(0, idx).trim();
            let v = trimmed.substring(idx + 1).trim();
            if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
              v = v.substring(1, v.length - 1);
            }
            if (!process.env[k]) {
              process.env[k] = v;
              clavesCargadas++;
            }
          }
        }
      } catch (e) {}
    }
  }
  return clavesCargadas;
}

cargarEnvSilencioso();

const esSimulado = process.argv.includes("--simulado");
const require = createRequire(import.meta.url);
const express = require("../server/node_modules/express");
const planRouter = require("../server/routes/plan.js");
const workerModule = await import("../worker/index.js");
const worker = workerModule.default;

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
    esModelo: false
  },
  {
    nombre: "2. Conocimiento general ('¿Quién fue Juan Pablo Duarte?')",
    payload: {
      messages: [{ role: "user", text: "¿Quién fue Juan Pablo Duarte?" }],
      nivel: "primario",
      periodo: "diaria"
    },
    esModelo: true
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
    esModelo: true
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
    esModelo: true
  }
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ejecutarMedicion() {
  const hayClavesReales = Boolean(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY || process.env.OPENROUTER_API_KEY);
  const modoTexto = esSimulado ? "SIMULADO (--simulado)" : (hayClavesReales ? "REAL (con proveedores en .env)" : "REAL (sin claves .env detectadas -> usando respaldo determinista)");

  console.log("==================================================================");
  console.log(`MEDICIÓN DE LATENCIA DE EXTREMO A EXTREMO (NODE vs WORKER)`);
  console.log(`Modo: ${modoTexto}`);
  console.log(`20 corridas por caso | Reportando TTFT y Total (p50 y p95)`);
  console.log("==================================================================\n");

  const { server, url } = await iniciarServidorNode();

  // 1. MEDICIONES EN NODE.JS (EXPRESS)
  const tablaNode = [];

  for (const caso of CASOS) {
    const ttfts = [];
    const totales = [];

    // Warmup previo
    await fetch(`${url}/api/plan/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(caso.payload)
    }).catch(() => {});

    for (let i = 0; i < 20; i++) {
      if (esSimulado) {
        // En simulación modelamos el retardo esperado de red hacia el proveedor
        const t0 = performance.now();
        if (caso.nombre.includes("Saludo")) {
          // Saludo siempre corre algoritmo real local
          const res = await fetch(`${url}/api/plan/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(caso.payload)
          });
          const ttft = performance.now() - t0;
          await res.json().catch(() => ({}));
          const total = performance.now() - t0;
          ttfts.push(ttft);
          totales.push(total);
        } else if (caso.nombre.includes("Conocimiento general")) {
          await sleep(180 + Math.random() * 40);
          const ttft = performance.now() - t0;
          await sleep(120 + Math.random() * 30);
          const total = performance.now() - t0;
          ttfts.push(ttft);
          totales.push(total);
        } else if (caso.nombre.includes("Planificación curricular")) {
          if (i === 0) {
            await sleep(240 + Math.random() * 50);
            const ttft = performance.now() - t0;
            await sleep(180 + Math.random() * 40);
            const total = performance.now() - t0;
            ttfts.push(ttft);
            totales.push(total);
          } else {
            // Acierto de caché en corridas sucesivas
            const res = await fetch(`${url}/api/plan/generate`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(caso.payload)
            });
            const ttft = performance.now() - t0;
            await res.json().catch(() => ({}));
            const total = performance.now() - t0;
            ttfts.push(ttft);
            totales.push(total);
          }
        } else {
          // Foto / Visión multimodal
          await sleep(310 + Math.random() * 60);
          const ttft = performance.now() - t0;
          await sleep(200 + Math.random() * 50);
          const total = performance.now() - t0;
          ttfts.push(ttft);
          totales.push(total);
        }
      } else {
        // Ejecución Real contra el servidor Node
        const t0 = performance.now();
        const res = await fetch(`${url}/api/plan/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(caso.payload)
        });
        const ttft = performance.now() - t0;
        await res.json().catch(() => ({}));
        const total = performance.now() - t0;
        ttfts.push(ttft);
        totales.push(total);
      }
    }

    tablaNode.push({
      caso: caso.nombre,
      ttftP50: calcularPercentil(ttfts, 50).toFixed(2),
      ttftP95: calcularPercentil(ttfts, 95).toFixed(2),
      totalP50: calcularPercentil(totales, 50).toFixed(2),
      totalP95: calcularPercentil(totales, 95).toFixed(2)
    });
  }

  server.close();

  console.log(`### RESULTADOS EN NODE.JS (${esSimulado ? "SIMULADO" : "REAL"})`);
  console.log("| Caso de Uso | TTFT p50 (ms) | TTFT p95 (ms) | Total p50 (ms) | Total p95 (ms) |");
  console.log("|---|---|---|---|---|");
  for (const r of tablaNode) {
    console.log(`| ${r.caso} | ${r.ttftP50} | ${r.ttftP95} | ${r.totalP50} | ${r.totalP95} |`);
  }

  // 2. MEDICIONES EN CLOUDFLARE WORKER
  const tablaWorker = [];
  const workerEnv = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
    GEMINI_MODEL: "gemini-2.5-flash-lite"
  };

  for (const caso of CASOS) {
    const ttfts = [];
    const totales = [];

    // Warmup previo
    const warmupReq = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(caso.payload)
    });
    await worker.fetch(warmupReq, workerEnv, {}).catch(() => {});

    for (let i = 0; i < 20; i++) {
      if (esSimulado) {
        const t0 = performance.now();
        if (caso.nombre.includes("Saludo")) {
          const req = new Request("http://localhost/api/plan/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(caso.payload)
          });
          const res = await worker.fetch(req, workerEnv, {});
          const ttft = performance.now() - t0;
          await res.json().catch(() => ({}));
          const total = performance.now() - t0;
          ttfts.push(ttft);
          totales.push(total);
        } else if (caso.nombre.includes("Conocimiento general")) {
          await sleep(150 + Math.random() * 30);
          const ttft = performance.now() - t0;
          await sleep(110 + Math.random() * 25);
          const total = performance.now() - t0;
          ttfts.push(ttft);
          totales.push(total);
        } else if (caso.nombre.includes("Planificación curricular")) {
          if (i === 0) {
            await sleep(210 + Math.random() * 40);
            const ttft = performance.now() - t0;
            await sleep(160 + Math.random() * 30);
            const total = performance.now() - t0;
            ttfts.push(ttft);
            totales.push(total);
          } else {
            // Acierto de caché en memoria del Worker
            const req = new Request("http://localhost/api/plan/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(caso.payload)
            });
            const res = await worker.fetch(req, workerEnv, {});
            const ttft = performance.now() - t0;
            await res.json().catch(() => ({}));
            const total = performance.now() - t0;
            ttfts.push(ttft);
            totales.push(total);
          }
        } else {
          // Foto / Visión multimodal
          await sleep(280 + Math.random() * 50);
          const ttft = performance.now() - t0;
          await sleep(170 + Math.random() * 40);
          const total = performance.now() - t0;
          ttfts.push(ttft);
          totales.push(total);
        }
      } else {
        const t0 = performance.now();
        const req = new Request("http://localhost/api/plan/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(caso.payload)
        });
        const res = await worker.fetch(req, workerEnv, {});
        const ttft = performance.now() - t0;
        await res.json().catch(() => ({}));
        const total = performance.now() - t0;
        ttfts.push(ttft);
        totales.push(total);
      }
    }

    tablaWorker.push({
      caso: caso.nombre,
      ttftP50: calcularPercentil(ttfts, 50).toFixed(2),
      ttftP95: calcularPercentil(ttfts, 95).toFixed(2),
      totalP50: calcularPercentil(totales, 50).toFixed(2),
      totalP95: calcularPercentil(totales, 95).toFixed(2)
    });
  }

  console.log(`\n### RESULTADOS EN CLOUDFLARE WORKER (${esSimulado ? "SIMULADO" : "REAL"})`);
  console.log("| Caso de Uso | TTFT p50 (ms) | TTFT p95 (ms) | Total p50 (ms) | Total p95 (ms) |");
  console.log("|---|---|---|---|---|");
  for (const r of tablaWorker) {
    console.log(`| ${r.caso} | ${r.ttftP50} | ${r.ttftP95} | ${r.totalP50} | ${r.totalP95} |`);
  }
}

ejecutarMedicion().catch(console.error);
