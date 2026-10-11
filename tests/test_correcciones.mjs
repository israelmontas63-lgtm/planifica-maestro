import test from "node:test";
import assert from "node:assert/strict";

// Importar módulo de Node (CommonJS) y Worker (ESM)
import nodeCorrector from "../server/ia/correctorTexto.js";
const {
  corregirTextoPedagogicoLocal: corregirLocalNode,
  corregirHomofonosDeVoz: homofonosNode,
  normalizarGradosHablados: gradosNode,
  distanciaLevenshtein: levenshteinNode,
  esNombreOFraseProtegida: protegidaNode
} = nodeCorrector;

const {
  corregirTextoPedagogicoLocal: corregirLocalWorker,
  corregirHomofonosDeVoz: homofonosWorker,
  normalizarGradosHablados: gradosWorker,
  distanciaLevenshtein: levenshteinWorker,
  esNombreOFraseProtegida: protegidaWorker
} = await import("../worker/correctorTexto.js");

test("ETAPA 3: Correcciones Inteligentes de Texto y Voz Pedagógica", async (t) => {

  await t.test("1. Tildes pedagógicas y mayúsculas de inicio y asignaturas", () => {
    const caso1 = corregirLocalNode("planificacion de matematicas para 3ro");
    assert.ok(caso1.textoCorregido.includes("Planificación"), "Debe corregir 'planificacion' a 'Planificación'");
    assert.ok(caso1.textoCorregido.includes("Matemáticas") || caso1.textoCorregido.includes("Matemática"), "Debe corregir 'matematicas' a 'Matemáticas'");
    assert.ok(caso1.textoCorregido.includes("3.º"), "Debe normalizar '3ro' a '3.º'");

    const caso2 = corregirLocalNode("evaluacion didactica con rubrica");
    assert.equal(caso2.textoCorregido, "Evaluación didáctica con rúbrica");

    const caso3 = corregirLocalNode("fotosintesis en ciencias de la naturaleza");
    assert.ok(caso3.textoCorregido.includes("Fotosíntesis"));
  });

  await t.test("2. Homófonos de voz frecuentes en dictado ('a ver'/'haber', 'hay'/'ahí', 'echo'/'hecho', 'tubo'/'tuvo')", () => {
    // 'vamos a ver' vs 'debe haber'
    const aVer = corregirLocalNode("vamos haber qué temas tocan hoy");
    assert.ok(aVer.textoCorregido.toLowerCase().includes("vamos a ver"), "Debe corregir 'vamos haber' por 'vamos a ver'");
    assert.ok(aVer.textoCorregido.startsWith("Vamos a ver"), "Debe capitalizar la primera letra");

    const haber = corregirLocalNode("tiene que a ver tres actividades");
    assert.ok(haber.textoCorregido.toLowerCase().includes("tiene que haber"), "Debe corregir 'tiene que a ver' por 'tiene que haber'");

    // 'hay' vs 'ahí'
    const ahi = corregirLocalNode("mira por hay en el libro");
    assert.ok(ahi.textoCorregido.toLowerCase().includes("por ahí"), "Debe corregir 'por hay' por 'por ahí'");

    const noHay = corregirLocalNode("no ahí problemas con el tiempo");
    assert.ok(noHay.textoCorregido.toLowerCase().includes("no hay"), "Debe corregir 'no ahí' por 'no hay'");

    // 'hecho' vs 'echo'
    const hecho = corregirLocalNode("he echo la secuencia didactica");
    assert.ok(hecho.textoCorregido.toLowerCase().includes("he hecho"), "Debe corregir 'he echo' por 'he hecho'");
    assert.ok(hecho.textoCorregido.toLowerCase().includes("secuencia didáctica"));

    // 'tuvo' vs 'tubo'
    const tuvo = corregirLocalNode("el profesor tubo dificultad");
    assert.ok(tuvo.textoCorregido.includes("tuvo"), "Debe corregir 'tubo dificultad' por 'tuvo dificultad'");

    // 'vaya' vs 'valla'
    const vaya = corregirLocalNode("para que valla al salón");
    assert.ok(vaya.textoCorregido.toLowerCase().includes("para que vaya"), "Debe corregir 'para que valla' por 'para que vaya'");
  });

  await t.test("3. Normalización de números hablados y dictados a grados MINERD ('3.º', '4.º', etc.)", () => {
    const casos = [
      { entrada: "planifica para primer grado de primaria", esperado: "1.º" },
      { entrada: "actividad para segundo grado", esperado: "2.º" },
      { entrada: "tercero de primaria de fracciones", esperado: "3.º" },
      { entrada: "ejercicios para 4to grado", esperado: "4.º" },
      { entrada: "quinto de primaria ciencias", esperado: "5.º" },
      { entrada: "evaluación para 6to", esperado: "6.º" }
    ];

    for (const { entrada, esperado } of casos) {
      const res = corregirLocalNode(entrada);
      assert.ok(res.textoCorregido.includes(esperado), `Entrada '${entrada}' debe contener '${esperado}'`);
    }
  });

  await t.test("4. Lista protegida estricta: próceres, escuelas y siglas nunca se modifican", () => {
    const textoProceres = "Vida y obra de Juan Pablo Duarte, Francisco del Rosario Sánchez y Matías Ramón Mella";
    const resProceres = corregirLocalNode(textoProceres);
    assert.ok(resProceres.textoCorregido.includes("Juan Pablo Duarte"));
    assert.ok(resProceres.textoCorregido.includes("Francisco del Rosario Sánchez"));
    assert.ok(resProceres.textoCorregido.includes("Matías Ramón Mella"));

    const textoEducadores = "Aportes pedagógicos de Salomé Ureña y Eugenio María de Hostos";
    const resEducadores = corregirLocalNode(textoEducadores);
    assert.ok(resEducadores.textoCorregido.includes("Salomé Ureña"));
    assert.ok(resEducadores.textoCorregido.includes("Eugenio María de Hostos"));

    const textoEscuela = "Plan de clase para la Escuela República de Colombia en 4to grado";
    const resEscuela = corregirLocalNode(textoEscuela);
    assert.ok(resEscuela.textoCorregido.includes("Escuela República de Colombia"));
    assert.ok(resEscuela.textoCorregido.includes("4.º"));

    const textoSiglas = "Normativa del MINERD con soporte PWA y TIC en el aula";
    const resSiglas = corregirLocalNode(textoSiglas);
    assert.ok(resSiglas.textoCorregido.includes("MINERD"));
    assert.ok(resSiglas.textoCorregido.includes("PWA"));
    assert.ok(resSiglas.textoCorregido.includes("TIC"));
  });

  await t.test("5. Levenshtein con distancia <= 2 contra términos curriculares clave", () => {
    assert.equal(levenshteinNode("matematica", "matemática"), 1);
    assert.equal(levenshteinNode("pedagojico", "pedagógico"), 2);
    assert.equal(levenshteinNode("fracione", "fracciones"), 2);

    const correccionErrata = corregirLocalNode("clase de pedagogico con fraciones para 3ro");
    assert.ok(correccionErrata.textoCorregido.includes("pedagógico") || correccionErrata.textoCorregido.includes("Pedagógico"));
    assert.ok(correccionErrata.textoCorregido.includes("fracciones"));
    assert.ok(correccionErrata.textoCorregido.includes("3.º"));
  });

  await t.test("6. Paridad estricta entre Node y Worker (100% idénticos)", () => {
    const frases = [
      "planificacion de matematicas para 3ro",
      "vamos haber qué actividades hay para 4to grado",
      "no ahí dudas sobre el proyecto de la Escuela República de Colombia",
      "he echo un plan sobre Juan Pablo Duarte en 5to",
      "evaluacion didactica con rubrica y metacognicion",
      "el docente tubo que preparar la fotosintesis para 2do"
    ];

    for (const f of frases) {
      const resN = corregirLocalNode(f);
      const resW = corregirLocalWorker(f);
      assert.equal(resN.textoCorregido, resW.textoCorregido, `Fallo de paridad para: "${f}"`);
      assert.deepEqual(resN.cambios, resW.cambios, `Fallo de paridad en cambios para: "${f}"`);
    }
  });

  await t.test("7. Resolución local ultrarrápida (< 5 ms y $0.00)", () => {
    const t0 = performance.now();
    for (let i = 0; i < 50; i++) {
      corregirLocalNode("planificacion de matematicas con rubrica para 3ro de primaria");
    }
    const tTotal = performance.now() - t0;
    const tPromedio = tTotal / 50;
    assert.ok(tPromedio < 5, `Tiempo promedio (${tPromedio.toFixed(2)} ms) debe ser menor a 5 ms`);
  });

  await t.test("8. Pruebas negativas del corrector: frases correctas que NO deben cambiar (mínimo 15 casos)", () => {
    const frasesCorrectas = [
      "hay que revisar el plan",
      "ha hecho la tarea",
      "voy a ver",
      "el tubo de ensayo",
      "vaya con cuidado",
      "competencias fundamentales",
      "indicadores de logro",
      "situación de aprendizaje",
      "secuencia didáctica",
      "contenidos conceptuales",
      "recuperación de saberes previos",
      "rúbrica analítica",
      "lista de cotejo",
      "biodiversidad en ciencias",
      "adecuación curricular",
      "unidad de aprendizaje",
      "fotosíntesis en las plantas",
      "metacognición en el aula"
    ];

    assert.ok(frasesCorrectas.length >= 15, "Deben ser al menos 15 frases");

    for (const f of frasesCorrectas) {
      const resN = corregirLocalNode(f);
      const resW = corregirLocalWorker(f);

      // Si empieza con minúscula, la función puede capitalizar la primera letra al inicio de oración
      const esperado = f.charAt(0).toUpperCase() + f.slice(1);
      assert.equal(resN.textoCorregido, esperado, `Node alteró frase válida: "${f}" -> "${resN.textoCorregido}"`);
      assert.equal(resW.textoCorregido, esperado, `Worker alteró frase válida: "${f}" -> "${resW.textoCorregido}"`);
      assert.equal(resN.cambios.length, 0, `Node no debe registrar cambios para: "${f}"`);
      assert.equal(resW.cambios.length, 0, `Worker no debe registrar cambios para: "${f}"`);
    }
  });

  await t.test("9. Levenshtein con largo mínimo >= 6 y resolución de empates / ambigüedades", () => {
    // Palabras menores a 6 caracteres NO se alteran por Levenshtein (ej. "caso", "mapa", "guia", "meta")
    const resCorta = corregirLocalNode("crear una guia de actividades");
    assert.equal(resCorta.textoCorregido, "Crear una guia de actividades");

    // Detección de empate a igual distancia mínima (ambigüedad Levenshtein)
    // "didactic" (largo 8) tiene distancia 2 tanto con "didáctica" como con "didáctico"
    // La función debe registrar tipo: 'ambiguedad_levenshtein', registrar ambos candidatos y NO cambiar la palabra a ciegas
    const resAmbN = corregirLocalNode("clase con enfoque didactic");
    const resAmbW = corregirLocalWorker("clase con enfoque didactic");
    assert.ok(resAmbN.tieneAmbiguedad, "Node debe reportar tieneAmbiguedad = true ante empates");
    assert.ok(resAmbW.tieneAmbiguedad, "Worker debe reportar tieneAmbiguedad = true ante empates");
    assert.ok(resAmbN.candidatosAmbiguos.length > 0, "Debe incluir candidatos ambiguos");
    assert.ok(resAmbN.candidatosAmbiguos[0].candidatos.includes("didáctica"));
    assert.ok(resAmbN.candidatosAmbiguos[0].candidatos.includes("didáctico"));
    assert.ok(resAmbN.textoCorregido.includes("didactic"), "No debe sustituir a ciegas si hay empate");
  });

  await t.test("10. Confirmación de cambios estructurales (grado, área o tema)", () => {
    // Cambio de grado con errata fonética: 'tersero' -> '3.º'
    const resTersero = corregirLocalNode("actividad para tersero de primaria");
    assert.ok(resTersero.cambioEstructural, "Debe marcar cambioEstructural = true para 'tersero'");
    assert.equal(resTersero.tipoCambioEstructural, "grado escolar");
    assert.ok(resTersero.textoCorregido.includes("3.º"));

    // Otro grado con errata: 'segumdo' -> '2.º'
    const resSegundo = corregirLocalNode("plan de clase para segumdo grado");
    assert.ok(resSegundo.cambioEstructural, "Debe marcar cambioEstructural para 'segumdo'");
    assert.equal(resSegundo.tipoCambioEstructural, "grado escolar");
    assert.ok(resSegundo.textoCorregido.includes("2.º"));

    // Frase sin cambios estructurales
    const resNormal = corregirLocalNode("hola buenos días profesor");
    assert.equal(resNormal.cambioEstructural, false);
  });

  await t.test("11. Contrato de respuesta y streaming con transparencia total (Node y Worker)", async () => {
    // 11a. Worker: verificar respuesta JSON con corrección
    const workerModule = await import("../worker/index.js");
    const worker = workerModule.default;
    const testEnv = { GEMINI_API_KEY: "fake_key", APP_ACCESS_KEY: "clave_test_123" };
    const authHeaders = { "Content-Type": "application/json", "x-app-key": "clave_test_123" };

    const reqWorker = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        messages: [{ role: "user", text: "hola profe didactica" }],
        nivel: "primario",
        periodo: "diaria"
      })
    });

    const resWorker = await worker.fetch(reqWorker, testEnv);

    const dataWorker = await resWorker.json();
    assert.equal(dataWorker.texto_original, "hola profe didactica");
    assert.equal(dataWorker.texto_corregido, "Hola profe didáctica");
    assert.equal(dataWorker.hubo_correcciones, true);
    assert.ok(Array.isArray(dataWorker.correcciones_aplicadas));
    assert.ok(dataWorker.correcciones_aplicadas.length > 0);

    // 11b. Worker: verificar streaming SSE emite evento { tipo: "correccion", ... }
    const reqStream = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        messages: [{ role: "user", text: "hola profe didactica" }],
        nivel: "primario",
        periodo: "diaria",
        stream: true
      })
    });

    const resStream = await worker.fetch(reqStream, testEnv);

    const textStream = await resStream.text();
    assert.ok(textStream.includes('"tipo":"correccion"'));
    assert.ok(textStream.includes('"texto_original":"hola profe didactica"'));
    assert.ok(textStream.includes('"texto_corregido":"Hola profe didáctica"'));
    assert.ok(textStream.includes('"hubo_correcciones":true'));

    // 11c. Opción forzarOriginal desactiva la corrección
    const reqForzar = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        messages: [{ role: "user", text: "hola profe didactica" }],
        nivel: "primario",
        periodo: "diaria",
        forzarOriginal: true
      })
    });

    const resForzar = await worker.fetch(reqForzar, testEnv);

    const dataForzar = await resForzar.json();
    assert.equal(dataForzar.texto_original, "hola profe didactica");
    assert.equal(dataForzar.texto_corregido, "hola profe didactica");
    assert.equal(dataForzar.hubo_correcciones, false);
    assert.equal(dataForzar.correcciones_aplicadas.length, 0);
  });

  await t.test("12. Discriminación semántica: mayúsculas/tildes no alteran significado, homófonos y erratas sí", async () => {
    // 12a. Tildes y mayúsculas puras -> cambioSignificado === false
    const casoTildesN = corregirLocalNode("didactica de matematicas");
    const casoTildesW = corregirLocalWorker("didactica de matematicas");
    assert.equal(casoTildesN.huboCambios, true);
    assert.equal(casoTildesN.cambioSignificado, false, "Solo tildes/mayúsculas no deben marcar cambio de significado en Node");
    assert.equal(casoTildesW.cambioSignificado, false, "Solo tildes/mayúsculas no deben marcar cambio de significado en Worker");

    const casoAcentosN = corregirLocalNode("evaluacion pedagogica en quimica");
    assert.equal(casoAcentosN.huboCambios, true);
    assert.equal(casoAcentosN.cambioSignificado, false);

    // 12b. Homófonos y sustituciones de palabras -> cambioSignificado === true
    const casoHaberN = corregirLocalNode("vamos haber los temas");
    const casoHaberW = corregirLocalWorker("vamos haber los temas");
    assert.equal(casoHaberN.cambioSignificado, true, "'vamos haber' -> 'vamos a ver' altera significado en Node");
    assert.equal(casoHaberW.cambioSignificado, true, "'vamos haber' -> 'vamos a ver' altera significado en Worker");

    const casoTuboN = corregirLocalNode("el docente tubo que salir");
    assert.equal(casoTuboN.cambioSignificado, true, "'tubo' -> 'tuvo' altera significado");

    const casoTerseroN = corregirLocalNode("plan para tersero");
    assert.equal(casoTerseroN.cambioSignificado, true, "'tersero' -> '3.º' altera significado");

    // 12c. Contrato API en Worker: cambio_significado viaja en JSON y SSE
    const workerModule = await import("../worker/index.js");
    const worker = workerModule.default;
    const testEnv = { GEMINI_API_KEY: "fake_key", APP_ACCESS_KEY: "clave_test_123" };
    const authHeaders = { "Content-Type": "application/json", "x-app-key": "clave_test_123" };

    // Caso solo tildes: cambio_significado = false
    const reqTildes = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        messages: [{ role: "user", text: "didactica de matematicas" }],
        nivel: "primario",
        periodo: "diaria"
      })
    });
    const resTildes = await worker.fetch(reqTildes, testEnv);
    const dataTildes = await resTildes.json();
    assert.equal(dataTildes.hubo_correcciones, true);
    assert.equal(dataTildes.cambio_significado, false, "La respuesta JSON del Worker debe indicar cambio_significado: false para tildes");

    // Caso homófono: cambio_significado = true
    const reqHomofono = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        messages: [{ role: "user", text: "vamos haber los planetas" }],
        nivel: "primario",
        periodo: "diaria",
        stream: true
      })
    });
    const resHomofono = await worker.fetch(reqHomofono, testEnv);
    const streamHomofono = await resHomofono.text();
    assert.ok(streamHomofono.includes('"cambio_significado":true'), "El stream SSE debe reportar cambio_significado: true para homófonos");
  });
});
