// Lectura y escritura de números en español. Sin dependencias ni APIs de Node (corre en Cloudflare Workers).
const ESPECIALES = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

function decenasATexto(r, apocope) {
  if (r < 30) {
    if (apocope && r === 1) return 'un';
    if (apocope && r === 21) return 'veintiún';
    return ESPECIALES[r];
  }
  const d = Math.floor(r / 10);
  const u = r % 10;
  if (u === 0) return DECENAS[d];
  return DECENAS[d] + ' y ' + (apocope && u === 1 ? 'un' : ESPECIALES[u]);
}

function bloqueATexto(n, apocope) {
  const c = Math.floor(n / 100);
  const r = n % 100;
  const partes = [];
  if (c > 0) partes.push(n === 100 ? 'cien' : CENTENAS[c]);
  if (r > 0) partes.push(decenasATexto(r, apocope));
  return partes.join(' ');
}

function milesATexto(x, apocopeFinal) {
  const t = Math.floor(x / 1000);
  const u = x % 1000;
  const partes = [];
  if (t > 0) partes.push(t === 1 ? 'mil' : bloqueATexto(t, true) + ' mil');
  if (u > 0) partes.push(bloqueATexto(u, apocopeFinal));
  return partes.join(' ');
}

// 0 a 999.999.999.999. Devuelve null si el valor no es un entero válido o está fuera de rango.
export function numeroALetras(valor) {
  if (typeof valor === 'string' && valor.trim() === '') return null;
  let n;
  try { n = BigInt(valor); } catch { return null; }
  if (n < 0n) {
    const t = numeroALetras(-n);
    return t === null ? null : 'menos ' + t;
  }
  if (n === 0n) return 'cero';
  if (n >= 1000000000000n) return null;
  const millones = Number(n / 1000000n);
  const resto = Number(n % 1000000n);
  const partes = [];
  if (millones > 0) partes.push(millones === 1 ? 'un millón' : milesATexto(millones, true) + ' millones');
  if (resto > 0) partes.push(milesATexto(resto, false));
  return partes.join(' ');
}

// 1234567 -> '1.234.567' (formato escolar dominicano: punto para miles).
export function formatearEntero(valor) {
  const n = BigInt(valor);
  const negativo = n < 0n;
  const s = (negativo ? -n : n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (negativo ? '-' : '') + s;
}
