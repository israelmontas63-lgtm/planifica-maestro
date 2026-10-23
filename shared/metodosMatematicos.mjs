// Métodos de resolución con los números reales del estudiante. Enteros exactos (BigInt), sin APIs de Node.
import { formatearEntero as f, numeroALetras } from './numeroLetras.mjs';

const aBig = (s) => BigInt(String(s).replace(/\./g, ''));

function terminos(n) {
  const s = n.toString();
  const t = [];
  for (let i = 0; i < s.length; i++) {
    const d = BigInt(s[i]);
    if (d !== 0n) t.push(d * 10n ** BigInt(s.length - 1 - i));
  }
  return t;
}

export function descomponer(n) {
  const t = terminos(n);
  return t.length ? t.map((x) => f(x)).join(' + ') : '0';
}

export function pasosSumaDescomposicion(a, b) {
  if (a === 0n && b === 0n) return ['0 + 0 = 0'];
  const sa = a.toString();
  const sb = b.toString();
  const largo = Math.max(sa.length, sb.length);
  const pasos = [`Descomponemos: ${f(a)} = ${descomponer(a)} y ${f(b)} = ${descomponer(b)}.`];
  const parciales = [];
  for (let p = largo - 1; p >= 0; p--) {
    const va = BigInt(sa[sa.length - 1 - p] ?? '0') * 10n ** BigInt(p);
    const vb = BigInt(sb[sb.length - 1 - p] ?? '0') * 10n ** BigInt(p);
    if (va === 0n && vb === 0n) continue;
    parciales.push(va + vb);
    pasos.push(`${f(va)} + ${f(vb)} = ${f(va + vb)}`);
  }
  pasos.push(`Juntamos: ${parciales.map((x) => f(x)).join(' + ')} = ${f(a + b)}`);
  return pasos;
}

// Resta por conteo hacia arriba (de b hasta a). Requiere a >= b; si no, devuelve null.
export function pasosRestaConteo(a, b) {
  if (a < b) return null;
  if (a === b) return [`${f(a)} − ${f(b)} = 0, porque son iguales.`];
  if (b === 0n) return [`Restar 0 no cambia el número: ${f(a)} − 0 = ${f(a)}.`];
  const pasos = [`Contamos hacia arriba desde ${f(b)} hasta ${f(a)}.`];
  const saltos = [];
  let cur = b;
  let pot = 10n;
  while (cur < a) {
    if (cur % pot === 0n) { pot *= 10n; continue; }
    const sig = (cur / pot + 1n) * pot;
    if (sig > a) break;
    pasos.push(`${f(cur)} + ${f(sig - cur)} = ${f(sig)}`);
    saltos.push(sig - cur);
    cur = sig;
    pot *= 10n;
  }
  let q = pot / 10n;
  while (cur < a && q >= 1n) {
    const k = (a - cur) / q;
    if (k > 0n) {
      const salto = k * q;
      pasos.push(`${f(cur)} + ${f(salto)} = ${f(cur + salto)}`);
      saltos.push(salto);
      cur += salto;
    }
    q /= 10n;
  }
  pasos.push(`Sumamos los saltos: ${saltos.map((x) => f(x)).join(' + ')} = ${f(a - b)}`);
  return pasos;
}

// Multiplicación con valor posicional: cada producto parcial lleva su valor real (347 × 20 = 6.940).
export function pasosMultiplicacionPosicional(a, b) {
  if (a === 0n || b === 0n) return ['Cualquier número multiplicado por 0 es 0.'];
  const sb = b.toString();
  const pasos = [];
  const parciales = [];
  for (let p = 0; p < sb.length; p++) {
    const d = BigInt(sb[sb.length - 1 - p]);
    if (d === 0n) { pasos.push('Dígito 0 en esa posición: el producto parcial vale 0.'); continue; }
    const valorB = d * 10n ** BigInt(p);
    const parcial = a * valorB;
    parciales.push(parcial);
    pasos.push(p === 0
      ? `${f(a)} × ${d} = ${f(parcial)}`
      : `${f(a)} × ${f(valorB)} = ${f(parcial)} (es ${f(a * d)} corrido ${p} ${p === 1 ? 'lugar' : 'lugares'} a la izquierda)`);
  }
  if (parciales.length > 1) pasos.push(`Sumamos los productos parciales: ${parciales.map((x) => f(x)).join(' + ')} = ${f(a * b)}`);
  return pasos;
}

// Multiplicación por áreas (tabla): descompone ambos factores y suma todas las áreas.
export function pasosMultiplicacionAreas(a, b) {
  if (a === 0n || b === 0n) return null;
  const ta = terminos(a);
  const tb = terminos(b);
  if (ta.length * tb.length > 25) return null;
  const pasos = [`Descomponemos: ${f(a)} = ${descomponer(a)} y ${f(b)} = ${descomponer(b)}.`];
  const productos = [];
  for (const x of ta) {
    for (const y of tb) {
      productos.push(x * y);
      pasos.push(`${f(x)} × ${f(y)} = ${f(x * y)}`);
    }
  }
  pasos.push(`Sumamos todas las áreas: ${productos.map((x) => f(x)).join(' + ')} = ${f(a * b)}`);
  return pasos;
}

// División larga cifra por cifra. Devuelve null si b es 0.
export function pasosDivisionLarga(a, b) {
  if (b === 0n) return null;
  const s = a.toString();
  const pasos = [`Dividimos ${f(a)} entre ${f(b)} con el algoritmo largo.`];
  let cur = 0n;
  let empezo = false;
  let cociente = '';
  for (let i = 0; i < s.length; i++) {
    cur = cur * 10n + BigInt(s[i]);
    if (!empezo && cur < b) {
      pasos.push(`Tomamos ${f(cur)}: es menor que ${f(b)}, seguimos con la siguiente cifra.`);
      continue;
    }
    empezo = true;
    const q = cur / b;
    const prod = q * b;
    const r = cur - prod;
    cociente += q.toString();
    pasos.push(`Tomamos ${f(cur)}: ${f(b)} × ${q} = ${f(prod)}; ${f(cur)} − ${f(prod)} = ${f(r)}.`);
    cur = r;
  }
  if (!empezo) cociente = '0';
  const q = BigInt(cociente);
  pasos.push(`Cociente: ${f(q)}, resto: ${f(cur)}.`);
  pasos.push(`Comprobación: ${f(q)} × ${f(b)} + ${f(cur)} = ${f(a)}.`);
  return pasos;
}

// Restas sucesivas (solo si el cociente es pequeño, hasta 15).
export function pasosDivisionRestasSucesivas(a, b) {
  if (b === 0n || a / b > 15n) return null;
  const pasos = [`Restamos ${f(b)} hasta que ya no se pueda.`];
  let cur = a;
  let veces = 0n;
  while (cur >= b) {
    const nuevo = cur - b;
    pasos.push(`${f(cur)} − ${f(b)} = ${f(nuevo)}`);
    cur = nuevo;
    veces += 1n;
  }
  pasos.push(`Restamos ${veces} ${veces === 1n ? 'vez' : 'veces'}, así que el cociente es ${veces} y sobra ${f(cur)}.`);
  return pasos;
}

const RE_AFIRMACION = /(?<![\d\/.,])(\d{1,3}(?:\.\d{3})+|\d+)(\s+\/\s+|\s*[+\-−–×xX*·÷:]\s*)(\d{1,3}(?:\.\d{3})+|\d+)\s*=\s*(\d{1,3}(?:\.\d{3})+|\d+)(?![\d\/]|[.,]\d)/;
const RE_DIV_CERO = /(?<![\d\/.,])(\d{1,3}(?:\.\d{3})+|\d+)(?:\s*[÷:]\s*|\s+\/\s+)0+(?!\d|[.,]\d)/;
const RE_DIV_CERO_PALABRAS = /(\d{1,3}(?:\.\d{3})+|\d+)\s*(?:dividido\s+(?:entre|por)|entre)\s*(?:0+(?!\d|[.,]\d)|cero\b)/i;

// Casos que el tutor general no resuelve bien: división entre cero y afirmaciones "a op b = c".
// Devuelve { tipo, correcta, resultado, mensaje } o null si el texto no es uno de esos casos.
export function respuestaEspecialMatematica(texto) {
  const t = String(texto ?? '');
  const mDiv = RE_DIV_CERO.exec(t) || RE_DIV_CERO_PALABRAS.exec(t);
  if (mDiv) {
    const a = aBig(mDiv[1]);
    return {
      tipo: 'division_por_cero',
      correcta: null,
      resultado: null,
      mensaje: `➗ ${f(a)} ÷ 0 no está definida. Pensemos: dividir ${f(a)} entre 0 es preguntar «¿cuántas veces cabe 0 en ${f(a)}?». Como 0 por cualquier número siempre da 0, nunca llegamos a ${f(a)}. Por eso la división entre cero no tiene resultado. (En cambio, 0 ÷ 5 sí está definida y vale 0.)`,
    };
  }
  const sinMiles = t.replace(/\d{1,3}(?:\.\d{3})+/g, '#');
  if (/\d[.,]\d/.test(sinMiles)) return null;
  const m = RE_AFIRMACION.exec(t);
  if (!m) return null;
  if (/[-−–]\s*$/.test(t.slice(0, m.index))) return null;
  const a = aBig(m[1]);
  const op = m[2].trim();
  const b = aBig(m[3]);
  const dicho = aBig(m[4]);
  let real;
  let simbolo;
  let resto = 0n;
  let exacta = true;
  let pasos = null;
  if (op === '+') {
    real = a + b; simbolo = '+'; pasos = pasosSumaDescomposicion(a, b);
  } else if (op === '-' || op === '−' || op === '–') {
    real = a - b; simbolo = '−'; pasos = a >= b ? pasosRestaConteo(a, b) : null;
  } else if (['×', 'x', 'X', '*', '·'].includes(op)) {
    real = a * b; simbolo = '×'; pasos = pasosMultiplicacionPosicional(a, b);
  } else {
    simbolo = '÷';
    real = a / b; resto = a % b; exacta = resto === 0n; pasos = pasosDivisionLarga(a, b);
  }
  const correcta = exacta && real === dicho;
  const expresion = `${f(a)} ${simbolo} ${f(b)}`;
  const textoReal = exacta ? f(real) : `${f(real)} (resto ${f(resto)})`;
  const lineas = [];
  if (correcta) {
    lineas.push(`✅ Sí, es correcto: ${expresion} = ${f(real)}.`);
    const letras = numeroALetras(real);
    if (letras) lineas.push(`En palabras: ${letras}.`);
  } else {
    if (!exacta && real === dicho) {
      lineas.push(`Casi: ${expresion} no da exactamente ${f(dicho)}. El cociente entero es ${f(real)} y sobran ${f(resto)}.`);
    } else {
      lineas.push(`No es correcto: ${expresion} = ${textoReal}, no ${f(dicho)}.`);
      if (exacta) {
        const dif = dicho > real ? dicho - real : real - dicho;
        lineas.push(`Tu resultado ${dicho > real ? 'se pasa' : 'se queda corto'} por ${f(dif)}.`);
      }
    }
    lineas.push('¡Buen intento! Revisemos juntos cómo se llega al resultado correcto:');
    if (pasos) lineas.push(...pasos);
  }
  return { tipo: 'verificacion', correcta, resultado: real.toString(), mensaje: lineas.join('\n') };
}
