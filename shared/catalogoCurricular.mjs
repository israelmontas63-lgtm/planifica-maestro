/**
 * shared/catalogoCurricular.mjs
 * 
 * Única fuente de verdad de taxonomía y normalización curricular para Planifica Maestro.
 */

export const NIVELES = ['Inicial', 'Primario', 'Secundario'];
export const AREAS = [
  'Lengua Española',
  'Matemática',
  'Ciencias Sociales',
  'Ciencias de la Naturaleza',
  'Educación Artística',
  'Educación Física',
  'Formación Integral Humana y Religiosa',
  'Lenguas Extranjeras - Inglés'
];
export const GRADOS = ['1ro', '2do', '3ro', '4to', '5to', '6to'];

export function normalizarTexto(txt) {
  if (!txt || typeof txt !== 'string') return '';
  return txt
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Convierte cualquier variante textual de grado a número entero (1..6).
 * Acepta variantes con o sin "grado", sufijos ordinales, palabras numéricas, etc.
 */
export function gradoANumero(grado) {
  if (typeof grado === 'number' && Number.isInteger(grado) && grado >= 1 && grado <= 6) {
    return grado;
  }
  if (!grado || typeof grado !== 'string') return null;

  const g = normalizarTexto(grado);
  if (/^0|7|8|9|10/.test(g)) return null;

  const tokens = g.split(/\s+/).filter(Boolean);
  const gradosDetectados = [];
  for (const t of tokens) {
    if (t === '1' || t.includes('1er') || t.includes('1ro') || t.includes('1.°') || t.includes('1.o') || t.includes('1.') || t.includes('primer')) {
      gradosDetectados.push(1);
    } else if (t === '2' || t.includes('2do') || t.includes('2.°') || t.includes('2.o') || t.includes('2.') || t.includes('segund')) {
      gradosDetectados.push(2);
    } else if (t === '3' || t.includes('3ro') || t.includes('3er') || t.includes('3.°') || t.includes('3.o') || t.includes('3.') || t.includes('tercer')) {
      gradosDetectados.push(3);
    } else if (t === '4' || t.includes('4to') || t.includes('4.°') || t.includes('4.o') || t.includes('4.') || t.includes('cuart')) {
      gradosDetectados.push(4);
    } else if (t === '5' || t.includes('5to') || t.includes('5.°') || t.includes('5.o') || t.includes('5.') || t.includes('quint')) {
      gradosDetectados.push(5);
    } else if (t === '6' || t.includes('6to') || t.includes('6.°') || t.includes('6.o') || t.includes('6.') || t.includes('sext')) {
      gradosDetectados.push(6);
    }
  }

  const unicos = [...new Set(gradosDetectados)];
  if (unicos.length > 1) return null;
  if (unicos.length === 1) return unicos[0];

  return null;
}

/**
 * Detecta menciones explícitas de múltiples grados en contextos multigrado
 * con expresiones regulares acotadas (evita '5 estudiantes' o '3 días').
 */
export function gradosMultiples(texto) {
  if (!texto || typeof texto !== 'string') return [];
  const t = normalizarTexto(texto);
  const encontrados = new Set();

  if (/\bprimer(?:o|a|er)?\b/.test(t)) encontrados.add(1);
  if (/\bsegund(?:o|a)?\b/.test(t)) encontrados.add(2);
  if (/\btercer(?:o|a)?\b/.test(t)) encontrados.add(3);
  if (/\bcuart(?:o|a)?\b/.test(t)) encontrados.add(4);
  if (/\bquint(?:o|a)?\b/.test(t)) encontrados.add(5);
  if (/\bsext(?:o|a)?\b/.test(t)) encontrados.add(6);

  if (/\b1\s*(?:ro|er|\.[°ºo]|\b\.[°ºo]?|[°º])\b|1\.[°ºo]/i.test(t)) encontrados.add(1);
  if (/\b2\s*(?:do|\.[°ºo]|\b\.[°ºo]?|[°º])\b|2\.[°ºo]/i.test(t)) encontrados.add(2);
  if (/\b3\s*(?:ro|er|\.[°ºo]|\b\.[°ºo]?|[°º])\b|3\.[°ºo]/i.test(t)) encontrados.add(3);
  if (/\b4\s*(?:to|\.[°ºo]|\b\.[°ºo]?|[°º])\b|4\.[°ºo]/i.test(t)) encontrados.add(4);
  if (/\b5\s*(?:to|\.[°ºo]|\b\.[°ºo]?|[°º])\b|5\.[°ºo]/i.test(t)) encontrados.add(5);
  if (/\b6\s*(?:to|\.[°ºo]|\b\.[°ºo]?|[°º])\b|6\.[°ºo]/i.test(t)) encontrados.add(6);

  const multiMatch = t.match(/\b(?:multigrado|grados?)\s+([0-9\s,ye]+)\b/);
  if (multiMatch) {
    const numPart = multiMatch[1];
    for (let g = 1; g <= 6; g++) {
      if (new RegExp('\\b' + g + '\\b').test(numPart)) {
        encontrados.add(g);
      }
    }
  }

  return Array.from(encontrados).sort((a, b) => a - b);
}

/**
 * Determina el ciclo oficial según el grado numérico en Primaria.
 */
export function cicloDeGrado(gradoNum) {
  if (typeof gradoNum !== 'number') return null;
  if (gradoNum >= 1 && gradoNum <= 3) return 'Primer Ciclo';
  if (gradoNum >= 4 && gradoNum <= 6) return 'Segundo Ciclo';
  return null;
}

/**
 * Normaliza el nivel a su formato canónico.
 */
export function normalizarNivel(nivel) {
  if (!nivel || typeof nivel !== 'string') return null;
  const n = normalizarTexto(nivel);
  if (n === 'inicial') return 'Inicial';
  if (n === 'primario' || n === 'primaria') return 'Primario';
  if (n === 'secundario' || n === 'secundaria') return 'Secundario';
  return null;
}

/**
 * Normaliza el área contra el catálogo AREAS (8 áreas oficiales).
 * Evalúa con prioridad: Educación Física, Artística, Inglés, Formación Humana,
 * Ciencias Sociales, Ciencias de la Naturaleza (sin 'fisic' suelto), Matemática y Lengua Española.
 * Si es desconocida o fuera de catálogo, lanza Error.
 */
export function normalizarArea(area) {
  if (!area || typeof area !== 'string') {
    throw new Error(`Área curricular inválida: ${area}`);
  }
  const a = normalizarTexto(area);

  // 1. Educación Física primero
  if (a.includes('educacion fisica') || a.includes('deporte') || a.includes('motriz')) {
    return 'Educación Física';
  }
  // 2. Educación Artística
  if (a.includes('artistica') || a.includes('artes') || a.includes('teatro') || a.includes('musica') || a.includes('danza')) {
    return 'Educación Artística';
  }
  // 3. Lenguas Extranjeras - Inglés
  if (a.includes('ingles') || a.includes('extranjera')) {
    return 'Lenguas Extranjeras - Inglés';
  }
  // 4. Formación Integral Humana y Religiosa
  if (a.includes('formacion') || a.includes('religios') || a.includes('humana') || a.includes('fihr')) {
    return 'Formación Integral Humana y Religiosa';
  }
  // 5. Ciencias Sociales
  if (a.includes('social') || a.includes('historia') || a.includes('geograf') || a.includes('ciudadan')) {
    return 'Ciencias Sociales';
  }
  // 6. Ciencias de la Naturaleza (SIN la raíz suelta 'fisic')
  if (/natural|biolog|quimic|ciencias fisicas|seres vivos|ecosistema/.test(a)) {
    return 'Ciencias de la Naturaleza';
  }
  // 7. Matemática (igual que hoy)
  if (a.includes('matemat') || a.includes('calculo') || a.includes('aritmetica') || a.includes('geometria')) {
    return 'Matemática';
  }
  // 8. Lengua Española (igual que hoy)
  if (a.includes('lengua') || a.includes('espanol') || a.includes('lectura') || a.includes('escritura') || a.includes('cuento') || a.includes('noticia')) {
    return 'Lengua Española';
  }

  throw new Error(`Área curricular no reconocida o fuera de catálogo: "${area}"`);
}
