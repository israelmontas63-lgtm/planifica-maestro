/**
 * tests/test_http_extremo_a_extremo.cjs
 * 
 * Verificación 3C.7: Prueba de extremo a extremo por HTTP real contra /api/plan
 * usando las dependencias de server/node_modules.
 */

const path = require("path");
const serverDir = path.resolve(__dirname, "../server");
require(path.join(serverDir, "node_modules/dotenv")).config({ path: path.join(serverDir, ".env") });
const express = require(path.join(serverDir, "node_modules/express"));
const planRoutes = require(path.join(serverDir, "routes/plan.js"));

const app = express();
app.use(express.json({ limit: "15mb" }));
app.use("/api/plan", planRoutes);

const PORT = 3099;

async function ejecutarPruebaHttp() {
  console.log("================================================================================");
  console.log("PRUEBA DE EXTREMO A EXTREMO POR HTTP REAL (/api/plan)");
  console.log("================================================================================\n");

  const server = app.listen(PORT);
  console.log(`✔ Servidor HTTP Express de prueba iniciado en http://localhost:${PORT}`);

  try {
    // 1. PETICIÓN CON IMAGEN ILEGIBLE (DEFENSA EN CÓDIGO)
    console.log("\n--- TEST 1: Petición HTTP con imagen 1x1 negra ---");
    const pixelNegro = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    const start1 = Date.now();

    const res1 = await fetch(`http://localhost:${PORT}/api/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "mira esta foto de mi pizarra" }],
        imageBase64: pixelNegro,
        mediaType: "image/png"
      })
    });

    const ms1 = Date.now() - start1;
    const json1 = await res1.json();

    console.log(`Código HTTP: ${res1.status}`);
    console.log(`Tiempo de respuesta: ${ms1} ms (Corte local determinista sin invocar IA)`);
    console.log(`Mensaje devuelto: "${json1.mensaje_chat}"`);
    console.log(`Modo: ${json1.modo} | Tipo visual: ${json1.tipo_visual}`);

    if (ms1 < 500 && json1.mensaje_chat && json1.mensaje_chat.includes("oscura o ilegible")) {
      console.log("✔ DEFENSA DE IMAGEN HTTP: VERIFICADA CON ÉXITO (Corte local inmediato sin invocar IA)");
    } else {
      console.log("❌ Falló criterio de defensa de imagen");
    }

    // 2. PETICIÓN FACTUAL (SALVAGUARDA DE SALUDO Y RESPUESTA DIRECTA)
    console.log("\n--- TEST 2: Petición HTTP factual sin saludo docente ---");
    const start2 = Date.now();

    const res2 = await fetch(`http://localhost:${PORT}/api/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "¿Cuántos municipios tiene la provincia de Santiago?" }]
      })
    });

    const ms2 = Date.now() - start2;
    const json2 = await res2.json();

    console.log(`Código HTTP: ${res2.status}`);
    console.log(`Tiempo de respuesta: ${ms2} ms`);
    console.log(`Mensaje devuelto (primeros 140 chars): "${json2.mensaje_chat?.substring(0, 140)}..."`);

    const primeraFrase = (json2.mensaje_chat || "").split(/[.\n]/)[0].toLowerCase();
    const tieneDiez = (json2.mensaje_chat || "").toLowerCase().includes("10") || (json2.mensaje_chat || "").toLowerCase().includes("diez");
    const noTieneSaludoInnecesario = !primeraFrase.startsWith("hola") && !primeraFrase.startsWith("buenos días") && !primeraFrase.startsWith("buenas tardes");

    if (tieneDiez && noTieneSaludoInnecesario) {
      console.log("✔ SALVAGUARDA DE SALUDO HTTP: VERIFICADA CON ÉXITO (Directo al contenido factual)");
    } else {
      console.log(`❌ Falló criterio de saludo: primeraFrase="${primeraFrase}", tieneDiez=${tieneDiez}`);
    }

  } finally {
    server.close();
    console.log("\n✔ Servidor HTTP Express de prueba cerrado limpiamente.");
  }
}

ejecutarPruebaHttp().catch(console.error);
