/**
 * tests/verificar_pedidos_claros.mjs
 * 
 * Verificación 3B.4:
 * Comprueba que si el usuario da un pedido claro y completo (grado, área, tema),
 * el asistente NO haga preguntas de más ni pida confirmaciones innecesarias,
 * sino que entregue directamente la planificación pedagógica.
 */

import fs from "node:fs";
import path from "node:path";
import { SYSTEM_PROMPT_CONVERSACIONAL } from "../worker/modoConversacional.js";

// Cargar variables de entorno
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

const PEDIDOS_CLAROS = [
  {
    id: 1,
    pedido: "Planifica la fotosíntesis para 4to de Primaria en Ciencias de la Naturaleza.",
    gradoEsperado: "4to",
    temaEsperado: "fotosíntesis"
  },
  {
    id: 2,
    pedido: "Estructura una clase sobre la suma de fracciones con igual denominador para 5to de Primaria en Matemática.",
    gradoEsperado: "5to",
    temaEsperado: "fracciones"
  },
  {
    id: 3,
    pedido: "Diseña una actividad sobre la Independencia Nacional para 2do de Secundaria en Ciencias Sociales.",
    gradoEsperado: "2do",
    temaEsperado: "independencia"
  },
  {
    id: 4,
    pedido: "Prepara una actividad de inicio sobre el cuento para 3ro de Primaria en Lengua Española.",
    gradoEsperado: "3ro",
    temaEsperado: "cuento"
  },
  {
    id: 5,
    pedido: "Planifica una clase sobre el teorema de Pitágoras para 3ro de Secundaria en Matemática.",
    gradoEsperado: "3ro",
    temaEsperado: "pitágoras"
  }
];

async function verificarPedidosClaros() {
  console.log("================================================================================");
  console.log("VERIFICACIÓN 3B.4: RESPUESTA ANTE PEDIDOS CLAROS (SIN PREGUNTAS DE MÁS)");
  console.log(`Modelo: ${model}`);
  console.log("================================================================================\n");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const resultados = [];

  for (const p of PEDIDOS_CLAROS) {
    process.stdout.write(`Probando pedido ${p.id}/5: "${p.pedido.substring(0, 45)}..." `);
    const start = Date.now();
    let intento = 0;
    const maxIntentos = 3;
    let exito = false;
    let ms = 0;
    let texto = "";

    while (intento < maxIntentos) {
      intento++;
      try {
        const start = Date.now();
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: p.pedido }] }],
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT_CONVERSACIONAL }] },
            generationConfig: { temperature: 0.2 }
          })
        });

        if (!res.ok) {
          if (intento < maxIntentos) {
            await new Promise((r) => setTimeout(r, 2500));
            continue;
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        texto = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const lower = texto.toLowerCase();

        const tieneEstructuraPlan = lower.includes("actividad") || lower.includes("inicio") || lower.includes("desarrollo") || lower.includes("cierre") || lower.includes("indicador") || lower.includes("estrategia") || lower.includes("propósito") || lower.includes("intención");
        const noPreguntaGrado = !lower.includes("¿en qué grado") && !lower.includes("¿para qué grado") && !lower.includes("¿cuál es el grado") && !lower.includes("¿de qué grado");
        const longitudAdecuada = texto.length >= 250;

        exito = tieneEstructuraPlan && noPreguntaGrado && longitudAdecuada;
        ms = Date.now() - start;
        break;
      } catch (e) {
        if (intento < maxIntentos) {
          await new Promise((r) => setTimeout(r, 3000));
          continue;
        }
        console.log(`⚠️ ERROR: ${e.message}`);
      }
    }

    if (exito) {
      console.log(`✔ PLANIFICA DIRECTO (${ms}ms) - Longitud: ${texto.length} chars`);
    } else {
      console.log(`❌ FALLÓ (${ms}ms) - tieneEstructura: ${tieneEstructuraPlan}, noPreguntaGrado: ${noPreguntaGrado}`);
    }

    resultados.push({
      ...p,
      exito,
      ms,
      longitud: texto.length,
      extracto: texto.substring(0, 150).replace(/\r?\n/g, " ") + "..."
    });
    await new Promise((r) => setTimeout(r, 600));
  }

  const exitosos = resultados.filter((r) => r.exito).length;
  console.log("\n--------------------------------------------------------------------------------");
  console.log(`RESULTADO FINAL 3B.4: ${exitosos}/5 pedidos claros atendidos directamente sin preguntas de más (${Math.round((exitosos / 5) * 100)}%)`);
  console.log("--------------------------------------------------------------------------------\n");
  return resultados;
}

verificarPedidosClaros().catch(console.error);
