/**
 * shared/catalogoCurricular.mjs
 * 
 * Única fuente de verdad de taxonomía y normalización curricular para Planifica Maestro.
 */

export const NIVELES = ['Inicial', 'Primario', 'Secundario'];
export const AREAS = ['Matemática', 'Lengua Española'];
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
 * Normaliza el área contra el catálogo AREAS ['Matemática', 'Lengua Española'].
 * Si es desconocida o fuera de catálogo, lanza Error.
 */
export function normalizarArea(area) {
  if (!area || typeof area !== 'string') {
    throw new Error(`Área curricular inválida: ${area}`);
  }
  const a = normalizarTexto(area);

  if (a.includes('matemat') || a.includes('calculo') || a.includes('aritmetica') || a.includes('geometria')) {
    return 'Matemática';
  }
  if (a.includes('lengua') || a.includes('espanol') || a.includes('lectura') || a.includes('escritura')) {
    return 'Lengua Española';
  }

  throw new Error(`Área curricular no reconocida o fuera de catálogo: "${area}"`);
}
