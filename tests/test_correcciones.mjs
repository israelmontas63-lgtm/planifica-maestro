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
});
