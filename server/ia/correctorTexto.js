/**
 * server/ia/correctorTexto.js
 * 
 * Corrector de Texto y Voz Pedagógico Multicapa para Planifica Maestro.
 * 
 * Capa 1 (Local, 0 ms, $0):
 *  - Tildes pedagógicas y mayúsculas de inicio y de asignaturas MINERD.
 *  - Homófonos frecuentes de voz ("a ver"/"haber", "hay"/"ahí", "echo"/"hecho", "tubo"/"tuvo", "valla"/"vaya").
 *  - Grados y ordinales hablados a nomenclatura estándar MINERD ("tercero" -> "3.º", "4to" -> "4.º").
 *  - Distancia Levenshtein (<= 2) contra términos clave curriculares.
 *  - Lista protegida estricta: próceres, educadores, centros escolares y siglas nunca se distorsionan.
 * 
 * Capa 2 (Contextual, conmutada por enrutadorIA):
 *  - Solo se activa ante ambigüedad real irresoluble por reglas locales y con cuota disponible.
 */

const { puedeRealizarConsulta } = require("./gestorGasto");
const { enrutarPeticion } = require("./enrutadorIA");

// ── 1. LISTA PROTEGIDA (Nunca se alteran por Levenshtein ni reglas agresivas) ──

const PROCERES_Y_EDUCADORES = [
  "Juan Pablo Duarte",
  "Francisco del Rosario Sánchez",
  "Matías Ramón Mella",
  "Salomé Ureña",
  "Eugenio María de Hostos",
  "Gregorio Luperón",
  "Pedro Henríquez Ureña",
  "Ercilia Pepín",
  "Concepción Bona",
  "María Trinidad Sánchez",
  "Emilio Prud'Homme",
  "José Reyes",
  "Las Hermanas Mirabal",
  "Patria Mirabal",
  "Minerva Mirabal",
  "María Teresa Mirabal"
];

const SIGLAS_PROTEGIDAS = new Set([
  "MINERD", "PWA", "TIC", "FIHR", "NFD", "PDF", "DOCX", "UNESCO",
  "UNICEF", "OEI", "IDEICE", "INAFOCAM", "ADOPROF", "ADP", "SEEBAC",
  "SEE", "RRF", "IA", "LRU", "TTL", "ESM", "CJS", "API", "JSON", "URL"
]);

// ── 2. VOCABULARIO PRIORITARIO MINERD ──

const VOCABULARIO_MINERD = [
  // Áreas
  "Lengua Española",
  "Matemática",
  "Matemáticas",
  "Ciencias Sociales",
  "Ciencias de la Naturaleza",
  "Educación Artística",
  "Educación Física",
  "Formación Integral Humana y Religiosa",
  "Lenguas Extranjeras",
  "Inglés",
  "Francés",

  // Componentes de planificación
  "competencias fundamentales",
  "competencias específicas",
  "indicadores de logro",
  "situación de aprendizaje",
  "secuencia didáctica",
  "contenidos conceptuales",
  "contenidos procedimentales",
  "contenidos actitudinales",
  "recuperación de saberes previos",
  "instrumentos de evaluación",
  "rúbrica analítica",
  "lista de cotejo",
  "metacognición",
  "adecuación curricular",
  "unidad de aprendizaje",
  "eje transversal",

  // Conceptos y términos pedagógicos clave
  "pedagógico",
  "pedagógica",
  "didáctico",
  "didáctica",
  "planificación",
  "evaluación",
  "rúbrica",
  "ortografía",
  "fracciones",
  "fracción",
  "multiplicación",
  "división",
  "geometría",
  "fotosíntesis",
  "ecosistema",
  "biodiversidad",
  "química",
  "física",
  "biología"
];

// Mapa directo de reemplazos de tildes y términos comunes
const REEMPLAZOS_DIRECTOS = {
  "planificacion": "planificación",
  "planificame": "planifícame",
  "evaluacion": "evaluación",
  "pedagogico": "pedagógico",
  "pedagogica": "pedagógica",
  "pedagojico": "pedagógico",
  "pedagojica": "pedagógica",
  "didactico": "didáctico",
  "didactica": "didáctica",
  "rubrica": "rúbrica",
  "rubricas": "rúbricas",
  "ortografia": "ortografía",
  "fraccion": "fracción",
  "fracciones": "fracciones",
  "fracione": "fracciones",
  "fraciones": "fracciones",
  "multiplicacion": "multiplicación",
  "division": "división",
  "geometria": "geometría",
  "fotosintesis": "fotosíntesis",
  "quimica": "química",
  "fisica": "física",
  "biologia": "biología",
  "metacognicion": "metacognición",
  "metacognitiva": "metacognitiva",
  "saberes": "saberes",
  "cotejo": "cotejo",
  "matematica": "Matemática",
  "matematicas": "Matemáticas",
  "espanola": "Española",
  "artistica": "Artística",
  "fisica": "Física"
};

// ── 3. DISTANCIA LEVENSHTEIN ──

function distanciaLevenshtein(a, b) {
  if (!a || !b) return (a || b || "").length;
  const s1 = a.toLowerCase();
  const s2 = b.toLowerCase();
  if (s1 === s2) return 0;

  const matriz = [];
  for (let i = 0; i <= s1.length; i++) {
    matriz[i] = [i];
  }
  for (let j = 0; j <= s2.length; j++) {
    matriz[0][j] = j;
  }

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const costo = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matriz[i][j] = Math.min(
        matriz[i - 1][j] + 1,       // eliminación
        matriz[i][j - 1] + 1,       // inserción
        matriz[i - 1][j - 1] + costo // sustitución
      );
    }
  }
  return matriz[s1.length][s2.length];
}

function esNombreOFraseProtegida(texto, palabra) {
  if (!palabra) return false;
  const pNorm = palabra.trim().toUpperCase();

  // 1. Sigla protegida
  if (SIGLAS_PROTEGIDAS.has(pNorm)) return true;

  // 2. Contenido dentro de próceres y educadores
  for (const procer of PROCERES_Y_EDUCADORES) {
    if (procer.toLowerCase().includes(palabra.toLowerCase())) return true;
  }

  // 3. Patrón de escuela o centro educativo
  const patronEscuela = /(?:escuela|liceo|colegio|instituto|politécnico|centro\s+educativo)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ\s.'"-]+)/i;
  const match = patronEscuela.exec(texto);
  if (match && match[0].toLowerCase().includes(palabra.toLowerCase())) {
    return true;
  }

  return false;
}

// ── 4. CORRECCIONES DE HOMÓFONOS Y REGLAS FONÉTICAS DE VOZ ──

function corregirHomofonosDeVoz(texto) {
  let res = texto;
  const correcciones = [];

  // A) "a ver" vs "haber"
  res = res.replace(/(^|\s)(vamos|voy|vas|va|fui|fuimos|pasa)\s+haber(?=\s|[.,;¿?¡!():]|$)/gi, (m, prep, v) => {
    correcciones.push({ antes: m.trim(), despues: `${v} a ver`, tipo: "homofono" });
    return `${prep}${v} a ver`;
  });

  res = res.replace(/(^|\s)(debe|deben|tiene\s+que|tienen\s+que|va\s+a|puede|pueden|podría|podrian)\s+a\s+ver(?=\s|[.,;¿?¡!():]|$)/gi, (m, prep, v) => {
    correcciones.push({ antes: m.trim(), despues: `${v} haber`, tipo: "homofono" });
    return `${prep}${v} haber`;
  });

  // B) "hay" vs "ahí"
  res = res.replace(/(^|\s)hay\s+(en|sobre|debajo|dentro|delante|detrás|detras|cerca|lejos)(?=\s|[.,;¿?¡!():]|$)/gi, (m, prep, g1) => {
    correcciones.push({ antes: m.trim(), despues: `ahí ${g1}`, tipo: "homofono" });
    return `${prep}ahí ${g1}`;
  });

  res = res.replace(/(^|\s)(por|de|hasta)\s+hay(?=\s|[.,;¿?¡!():]|$)/gi, (m, prep, g1) => {
    correcciones.push({ antes: m.trim(), despues: `${g1} ahí`, tipo: "homofono" });
    return `${prep}${g1} ahí`;
  });

  res = res.replace(/(^|\s)(?:ahí|ahi)\s+que(?=\s|[.,;¿?¡!():]|$)/gi, (m, prep) => {
    correcciones.push({ antes: m.trim(), despues: "hay que", tipo: "homofono" });
    return `${prep}hay que`;
  });

  res = res.replace(/(^|\s)no\s+(?:ahí|ahi)(?=\s|[.,;¿?¡!():]|$)/gi, (m, prep) => {
    correcciones.push({ antes: m.trim(), despues: "no hay", tipo: "homofono" });
    return `${prep}no hay`;
  });

  // C) "hecho" vs "echo"
  res = res.replace(/(^|\s)(he|has|ha|hemos|han|había|habia|está|esta|están|estan|bien|mal)\s+echo(?=\s|[.,;¿?¡!():]|$)/gi, (m, prep, g1) => {
    correcciones.push({ antes: m.trim(), despues: `${g1} hecho`, tipo: "homofono" });
    return `${prep}${g1} hecho`;
  });

  // D) "tubo" vs "tuvo"
  res = res.replace(/(^|\s)tubo\s+(que|miedo|éxito|exito|dificultad|problemas)(?=\s|[.,;¿?¡!():]|$)/gi, (m, prep, g1) => {
    correcciones.push({ antes: m.trim(), despues: `tuvo ${g1}`, tipo: "homofono" });
    return `${prep}tuvo ${g1}`;
  });

  res = res.replace(/(^|\s)(el|un)\s+tuvo(?=\s|[.,;¿?¡!():]|$)/gi, (m, prep, g1) => {
    correcciones.push({ antes: m.trim(), despues: `${g1} tubo`, tipo: "homofono" });
    return `${prep}${g1} tubo`;
  });

  // E) "valla" vs "vaya"
  res = res.replace(/(^|\s)(para\s+que|cuando|ojalá|ojala)\s+valla(?=\s|[.,;¿?¡!():]|$)/gi, (m, prep, g1) => {
    correcciones.push({ antes: m.trim(), despues: `${g1} vaya`, tipo: "homofono" });
    return `${prep}${g1} vaya`;
  });

  return { texto: res, correcciones };
}

// ── 5. NORMALIZACIÓN DE GRADOS Y ORDINALES HABLADOS MINERD ──

function normalizarGradosHablados(texto) {
  let res = texto;
  const correcciones = [];

  const patronesGrados = [
    { regex: /\b(?:1ero|1ro|1°|primer\s+grado|primero\s+de\s+primaria|primero\s+primaria)\b/gi, valor: "1.º" },
    { regex: /\b(?:2do|2°|segundo\s+grado|segundo\s+de\s+primaria|segundo\s+primaria)\b/gi, valor: "2.º" },
    { regex: /\b(?:3ro|3ero|3er\s+grado|tercer\s+grado|tercero\s+de\s+primaria|tercero\s+primaria|tercero(?=\s+grado|\s+de\b|\b))\b/gi, valor: "3.º" },
    { regex: /\b(?:4to|4°|cuarto\s+grado|cuarto\s+de\s+primaria|cuarto\s+primaria)\b/gi, valor: "4.º" },
    { regex: /\b(?:5to|5°|quinto\s+grado|quinto\s+de\s+primaria|quinto\s+primaria)\b/gi, valor: "5.º" },
    { regex: /\b(?:6to|6°|sexto\s+grado|sexto\s+de\s+primaria|sexto\s+primaria)\b/gi, valor: "6.º" }
  ];

  for (const { regex, valor } of patronesGrados) {
    res = res.replace(regex, (m) => {
      correcciones.push({ antes: m, despues: valor, tipo: "grado_minerd" });
      return valor;
    });
  }

  return { texto: res, correcciones };
}

// ── 6. CORRECCIÓN LOCAL PRINCIPAL (Reglas + Levenshtein + Preservación) ──

function corregirTextoPedagogicoLocal(textoOriginal) {
  if (!textoOriginal || typeof textoOriginal !== "string") {
    return {
      textoOriginal: "",
      textoCorregido: "",
      cambios: [],
      huboCambios: false
    };
  }

  let texto = textoOriginal;
  const cambios = [];

  // Paso 1: Normalizar homófonos de voz
  const pasoHomofonos = corregirHomofonosDeVoz(texto);
  texto = pasoHomofonos.texto;
  cambios.push(...pasoHomofonos.correcciones);

  // Paso 2: Normalizar números y grados a nomenclatura MINERD
  const pasoGrados = normalizarGradosHablados(texto);
  texto = pasoGrados.texto;
  cambios.push(...pasoGrados.correcciones);

  // Paso 3: Reemplazos directos y tildes pedagógicas
  // Tokenizamos preservando puntuación
  const palabras = texto.split(/(\s+|[.,;¿?¡!():])/);

  for (let i = 0; i < palabras.length; i++) {
    const token = palabras[i];
    if (!token || /^\s+$/.test(token) || /^[.,;¿?¡!():]+$/.test(token)) continue;

    // Verificar si es palabra protegida (nombres, siglas, escuelas)
    if (esNombreOFraseProtegida(textoOriginal, token)) {
      continue; // NO TOCAR
    }

    const tokenLimpio = token.toLowerCase().trim();

    // 3a. Reemplazo directo en diccionario común
    if (REEMPLAZOS_DIRECTOS[tokenLimpio]) {
      const sustituto = REEMPLAZOS_DIRECTOS[tokenLimpio];
      if (token !== sustituto) {
        // Preservar mayúscula si el original la tenía
        const conMayus = (token[0] === token[0].toUpperCase())
          ? sustituto.charAt(0).toUpperCase() + sustituto.slice(1)
          : sustituto;

        cambios.push({ antes: token, despues: conMayus, tipo: "tilde_vocabulario" });
        palabras[i] = conMayus;
      }
      continue;
    }

    // 3b. Levenshtein contra vocabulario MINERD si longitud >= 5
    if (tokenLimpio.length >= 5) {
      let mejorCoincidencia = null;
      let menorDistancia = Infinity;

      for (const termino of VOCABULARIO_MINERD) {
        // Solo comparar con palabras individuales del vocabulario
        const partesTermino = termino.split(/\s+/);
        for (const parte of partesTermino) {
          const pMin = parte.toLowerCase();
          if (Math.abs(pMin.length - tokenLimpio.length) > 2) continue;

          const dist = distanciaLevenshtein(tokenLimpio, pMin);
          if (dist > 0 && dist <= 2 && dist < menorDistancia) {
            menorDistancia = dist;
            mejorCoincidencia = parte;
          }
        }
      }

      if (mejorCoincidencia && menorDistancia <= 2) {
        const conMayus = (token[0] === token[0].toUpperCase())
          ? mejorCoincidencia.charAt(0).toUpperCase() + mejorCoincidencia.slice(1)
          : mejorCoincidencia.toLowerCase();

        cambios.push({ antes: token, despues: conMayus, tipo: "levenshtein_minerd" });
        palabras[i] = conMayus;
      }
    }
  }

  texto = palabras.join("");

  // Paso 4: Mayúscula al inicio de la frase si corresponde
  if (texto.length > 0 && /^[a-záéíóúñ]/.test(texto)) {
    texto = texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  // Limpiar espacios múltiples
  texto = texto.replace(/[ \t]+/g, " ").trim();

  return {
    textoOriginal,
    textoCorregido: texto,
    cambios,
    huboCambios: texto !== textoOriginal.trim()
  };
}

// ── 7. CAPA CONTEXTUAL CON ENRUTADOR IA (Solo cuando hay ambigüedad real) ──

async function corregirTextoPedagogico({ texto = "", usarIA = false, env = process.env, signal = null }) {
  // Primero aplicar siempre la capa local ($0 costo, 0 ms)
  const resLocal = corregirTextoPedagogicoLocal(texto);

  // Si no se pide IA o no hay cuota o el texto quedó bien resuelto localmente:
  if (!usarIA || !puedeRealizarConsulta(300)) {
    return resLocal;
  }

  // Si el texto es muy corto o ya fue corregido limpiamente sin ambigüedad restante:
  if (resLocal.textoCorregido.length < 8) {
    return resLocal;
  }

  try {
    const promptCorreccion = `Eres el módulo de corrección ortográfica y fonética pedagógica de Planifica Maestro (República Dominicana).
Corrige el siguiente texto dictado o escrito por un docente.
Reglas estrictas:
1. Aplica tildes y concordancia gramatical correcta en español.
2. Normaliza términos MINERD y grados escolares (ej: "3.º de Primaria").
3. NUNCA cambies nombres propios de próceres dominicanos, educadores ni nombres de escuelas.
4. Responde ÚNICAMENTE con el texto corregido, sin explicaciones ni saludos.

Texto: "${resLocal.textoCorregido}"`;

    const respuestaIA = await enrutarPeticion({
      tema: "Corrección fonética y ortográfica",
      prompt: promptCorreccion,
      env,
      signal
    });

    if (respuestaIA && !respuestaIA.error && respuestaIA.texto) {
      const textoIA = respuestaIA.texto.replace(/^["']|["']$/g, "").trim();
      if (textoIA && textoIA !== resLocal.textoCorregido) {
        return {
          textoOriginal: texto,
          textoCorregido: textoIA,
          cambios: [
            ...resLocal.cambios,
            { antes: resLocal.textoCorregido, despues: textoIA, tipo: "contextual_ia" }
          ],
          huboCambios: true,
          corregidoConIA: true
        };
      }
    }
  } catch (err) {
    // Falla silenciosa y segura de la capa IA: retorno garantizado de la capa local
  }

  return resLocal;
}

module.exports = {
  corregirTextoPedagogicoLocal,
  corregirTextoPedagogico,
  distanciaLevenshtein,
  esNombreOFraseProtegida,
  corregirHomofonosDeVoz,
  normalizarGradosHablados,
  VOCABULARIO_MINERD,
  PROCERES_Y_EDUCADORES,
  SIGLAS_PROTEGIDAS
};
