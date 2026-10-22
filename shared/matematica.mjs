/**
 * shared/matematica.mjs
 * Motor matemático determinista y tutor pedagógico para Nivel Primario (1.° a 6.° grado).
 * Compatible 100% con Cloudflare Workers (sin dependencias externas ni APIs exclusivas de Node).
 * Aritmética exacta con BigInt y Fracción propia (CERO errores de punto flotante).
 */

// ============================================================================
// 1. CLASE FRACCIÓN Y ARITMÉTICA EXACTA
// ============================================================================

export class Fraccion {
  constructor(numerador, denominador = 1n) {
    let num = typeof numerador === 'bigint' ? numerador : BigInt(numerador);
    let den = typeof denominador === 'bigint' ? denominador : BigInt(denominador);

    if (den === 0n) {
      throw new Error('DIVISION_POR_CERO: El denominador no puede ser cero.');
    }
    if (den < 0n) {
      num = -num;
      den = -den;
    }
    const divisor = mcdBigInt(num < 0n ? -num : num, den);
    this.num = num / divisor;
    this.den = den / divisor;
  }

  static fromString(str) {
    if (!str || typeof str !== 'string') return new Fraccion(0n);
    const s = str.trim().replace(/\s+/g, '');
    
    // Fracción simple "a/b"
    if (s.includes('/')) {
      const partes = s.split('/');
      return new Fraccion(BigInt(partes[0]), BigInt(partes[1]));
    }
    // Número decimal con coma o punto
    if (s.includes(',') || s.includes('.')) {
      const limpio = s.replace(',', '.');
      const partes = limpio.split('.');
      const enteros = partes[0] ? BigInt(partes[0]) : 0n;
      const decStr = partes[1] || '';
      const potencia = 10n ** BigInt(decStr.length);
      const decVal = BigInt(decStr);
      const signo = enteros < 0n || limpio.startsWith('-') ? -1n : 1n;
      const absEnteros = enteros < 0n ? -enteros : enteros;
      const numTotal = signo * (absEnteros * potencia + decVal);
      return new Fraccion(numTotal, potencia);
    }
    // Entero
    return new Fraccion(BigInt(s), 1n);
  }

  sumar(otra) {
    return new Fraccion(this.num * otra.den + otra.num * this.den, this.den * otra.den);
  }

  restar(otra) {
    return new Fraccion(this.num * otra.den - otra.num * this.den, this.den * otra.den);
  }

  multiplicar(otra) {
    return new Fraccion(this.num * otra.num, this.den * otra.den);
  }

  dividir(otra) {
    if (otra.num === 0n) throw new Error('DIVISION_POR_CERO: No se puede dividir entre cero.');
    return new Fraccion(this.num * otra.den, this.den * otra.num);
  }

  potencia(exp) {
    const e = BigInt(exp);
    if (e < 0n) throw new Error('EXPONENTE_NEGATIVO: No contemplado en Primaria.');
    return new Fraccion(this.num ** e, this.den ** e);
  }

  esEntero() {
    return this.den === 1n;
  }

  toDecimalString(maxDec = 6) {
    if (this.den === 1n) return this.num.toString();
    const signo = this.num < 0n ? '-' : '';
    const absNum = this.num < 0n ? -this.num : this.num;
    const enteros = absNum / this.den;
    let residuo = absNum % this.den;
    if (residuo === 0n) return `${signo}${enteros}`;

    let decStr = '';
    let count = 0;
    while (residuo !== 0n && count < maxDec) {
      residuo *= 10n;
      const d = residuo / this.den;
      residuo = residuo % this.den;
      decStr += d.toString();
      count++;
    }
    // Formato dominicano: coma para decimales
    return `${signo}${enteros},${decStr}`;
  }

  toMixtoString() {
    if (this.den === 1n) return this.num.toString();
    const absNum = this.num < 0n ? -this.num : this.num;
    const enteros = absNum / this.den;
    const resto = absNum % this.den;
    const signo = this.num < 0n ? '-' : '';
    if (enteros === 0n) return `${signo}${this.num}/${this.den}`;
    if (resto === 0n) return `${signo}${enteros}`;
    return `${signo}${enteros} ${resto}/${this.den}`;
  }

  toString() {
    if (this.den === 1n) return this.num.toString();
    return `${this.num}/${this.den}`;
  }
}

export function mcdBigInt(a, b) {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x === 0n ? 1n : x;
}

export function mcmBigInt(a, b) {
  if (a === 0n || b === 0n) return 0n;
  const x = a < 0n ? -a : a;
  const y = b < 0n ? -b : b;
  return (x * y) / mcdBigInt(x, y);
}

// ============================================================================
// 2. PARSEO DE FORMATO NUMÉRICO ESCOLAR DOMINICANO
// ============================================================================

export function interpretarNumero(str) {
  if (!str) return { valor: 0n, frac: new Fraccion(0n), texto: '0' };
  let s = String(str).trim();

  // Si tiene formato "4.835" donde hay exactamente 3 dígitos tras el punto -> miles
  if (/^\d{1,3}(?:\.\d{3})+$/.test(s)) {
    const sinPuntos = s.replace(/\./g, '');
    return {
      valor: BigInt(sinPuntos),
      frac: new Fraccion(BigInt(sinPuntos)),
      texto: formatearMiles(sinPuntos),
      tipo: 'entero_miles'
    };
  }

  // Si tiene coma decimal "0,5" o "4,835" (con coma) -> decimal
  if (s.includes(',')) {
    const f = Fraccion.fromString(s);
    return {
      valor: f.num / f.den,
      frac: f,
      texto: s,
      tipo: 'decimal'
    };
  }

  // Si tiene punto y no son miles estándar (ej. "0.5") -> decimal
  if (/^\d+\.\d+$/.test(s) && !/^\d{1,3}(?:\.\d{3})+$/.test(s)) {
    const f = Fraccion.fromString(s);
    return {
      valor: f.num / f.den,
      frac: f,
      texto: f.toDecimalString(),
      tipo: 'decimal'
    };
  }

  // Fracción "3/4"
  if (s.includes('/')) {
    const f = Fraccion.fromString(s);
    return {
      valor: f.num / f.den,
      frac: f,
      texto: f.toString(),
      tipo: 'fraccion'
    };
  }

  // Entero normal
  const enteroLimpio = s.replace(/[^0-9\-]/g, '');
  const b = BigInt(enteroLimpio || '0');
  return {
    valor: b,
    frac: new Fraccion(b),
    texto: formatearMiles(b.toString()),
    tipo: 'entero'
  };
}

export function formatearMiles(str) {
  const s = String(str);
  const signo = s.startsWith('-') ? '-' : '';
  const num = signo ? s.slice(1) : s;
  return signo + num.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// ============================================================================
// 3. LECTURA Y ESCRITURA DE NÚMEROS EN ESPAÑOL (LETRAS A CIFRAS Y CIFRAS A LETRAS)
// ============================================================================

const UNIDADES_PALABRAS = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
const ESPECIALES_10_19 = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
const DECENAS_PALABRAS = ['', 'diez', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const CENTENAS_PALABRAS = ['', 'cien', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

export function numeroALetras(n) {
  let num = typeof n === 'bigint' ? n : BigInt(n);
  if (num === 0n) return 'cero';
  if (num < 0n) return `menos ${numeroALetras(-num)}`;

  function resolverMenor1000(val) {
    const v = Number(val);
    if (v === 0) return '';
    if (v === 100) return 'cien';
    const c = Math.floor(v / 100);
    const restoC = v % 100;
    let parteC = '';
    if (c === 1 && restoC > 0) parteC = 'ciento ';
    else if (c > 1) parteC = `${CENTENAS_PALABRAS[c]} `;

    let parteD = '';
    if (restoC >= 10 && restoC <= 19) {
      parteD = ESPECIALES_10_19[restoC - 10];
    } else if (restoC >= 21 && restoC <= 29) {
      parteD = `veinti${UNIDADES_PALABRAS[restoC - 20]}`;
    } else {
      const d = Math.floor(restoC / 10);
      const u = restoC % 10;
      if (d > 0 && u > 0) parteD = `${DECENAS_PALABRAS[d]} y ${UNIDADES_PALABRAS[u]}`;
      else if (d > 0) parteD = DECENAS_PALABRAS[d];
      else if (u > 0) parteD = UNIDADES_PALABRAS[u];
    }
    return (parteC + parteD).trim();
  }

  if (num < 1000n) return resolverMenor1000(num);

  if (num < 1000000n) {
    const miles = num / 1000n;
    const resto = num % 1000n;
    const prefijoMiles = miles === 1n ? 'mil' : `${resolverMenor1000(miles)} mil`;
    const restoStr = resto > 0n ? ` ${resolverMenor1000(resto)}` : '';
    return `${prefijoMiles}${restoStr}`.trim();
  }

  if (num < 1000000000000n) {
    const millones = num / 1000000n;
    const resto = num % 1000000n;
    const prefijoMillones = millones === 1n ? 'un millón' : `${numeroALetras(millones)} millones`;
    const restoStr = resto > 0n ? ` ${numeroALetras(resto)}` : '';
    return `${prefijoMillones}${restoStr}`.trim();
  }

  return num.toString();
}

export function letrasANumero(texto) {
  if (!texto || typeof texto !== 'string') return 0n;
  const mapa = {
    cero: 0n, un: 1n, uno: 1n, una: 1n, dos: 2n, tres: 3n, cuatro: 4n, cinco: 5n,
    seis: 6n, siete: 7n, ocho: 8n, nueve: 9n, diez: 10n, once: 11n, doce: 12n,
    trece: 13n, catorce: 14n, quince: 15n, dieciseis: 16n, dieciséis: 16n,
    diecisiete: 17n, dieciocho: 18n, diecinueve: 19n, veinte: 20n, veintiuno: 21n,
    veintidos: 22n, veintidós: 22n, veintitres: 23n, veintitrés: 23n, veinticuatro: 24n,
    veinticinco: 25n, veintiseis: 26n, veintiséis: 26n, veintisiete: 27n, veintiocho: 28n,
    veintinueve: 29n, treinta: 30n, cuarenta: 40n, cincuenta: 50n, sesenta: 60n,
    setenta: 70n, ochenta: 80n, noventa: 90n, cien: 100n, ciento: 100n,
    doscientos: 200n, doscientas: 200n, trescientos: 300n, trescientas: 300n,
    cuatrocientos: 400n, cuatrocientas: 400n, quinientos: 500n, quinientas: 500n,
    seiscientos: 600n, seiscientas: 600n, setecientos: 700n, setecientas: 700n,
    ochocientos: 800n, ochocientas: 800n, novecientos: 900n, novecientas: 900n,
    mil: 1000n, millon: 1000000n, millón: 1000000n, millones: 1000000n
  };

  const palabras = texto.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, m => (m === '\u0301' ? '' : m))
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  let total = 0n;
  let parcial = 0n;

  for (const p of palabras) {
    if (p === 'y') continue;
    if (p === 'millon' || p === 'millón' || p === 'millones') {
      if (parcial === 0n) parcial = 1n;
      total += parcial * 1000000n;
      parcial = 0n;
    } else if (p === 'mil') {
      if (parcial === 0n) parcial = 1n;
      total += parcial * 1000n;
      parcial = 0n;
    } else if (mapa[p] !== undefined) {
      parcial += mapa[p];
    }
  }
  return total + parcial;
}

// ============================================================================
// 4. MÉTODOS DIDÁCTICOS Y RESOLUTORES
// ============================================================================

export function resolverSuma(aStr, bStr, opciones = {}) {
  const numA = interpretarNumero(aStr);
  const numB = interpretarNumero(bStr);

  if (numA.tipo === 'decimal' || numB.tipo === 'decimal') {
    const fA = numA.frac;
    const fB = numB.frac;
    const sumaF = fA.sumar(fB);
    const resultado = sumaF.toDecimalString();
    return {
      operacion: 'suma',
      resultadoExacto: resultado,
      lecturaPalabras: `${resultado} (${numeroALetras(sumaF.num / sumaF.den)})`,
      metodoPrincipal: {
        nombre: 'Alineación de columnas decimales',
        pasos: [
          `Alineamos los números por la coma decimal: ${numA.texto} + ${numB.texto}`,
          `Sumamos los valores posicionales de derecha a izquierda manteniendo la coma alineada.`,
          `Resultado final: ${resultado}`
        ]
      },
      otrosMetodos: [
        {
          nombre: 'Fracciones decimales equivalentes',
          pasos: [
            `Convertimos a fracción: ${fA.toString()} + ${fB.toString()}`,
            `Sumamos con denominador común: ${sumaF.toString()} = ${resultado}`
          ]
        }
      ],
      prueba: `Operación inversa (resta): ${resultado} − ${numB.texto} = ${numA.texto}`
    };
  }

  const a = numA.valor;
  const b = numB.valor;
  const suma = a + b;
  const aFmt = formatearMiles(a.toString());
  const bFmt = formatearMiles(b.toString());
  const resFmt = formatearMiles(suma.toString());

  const sA = a.toString();
  const sB = b.toString();
  const maxLen = Math.max(sA.length, sB.length);
  const padA = sA.padStart(maxLen, '0');
  const padB = sB.padStart(maxLen, '0');
  const pasosColumnas = [];
  let llevada = 0;
  const nombresPos = ['unidades', 'decenas', 'centenas', 'unidades de mil', 'decenas de mil', 'centenas de mil'];

  for (let i = maxLen - 1; i >= 0; i--) {
    const da = parseInt(padA[i], 10);
    const db = parseInt(padB[i], 10);
    const sumaCol = da + db + llevada;
    const posNombre = nombresPos[maxLen - 1 - i] || `posición 10^${maxLen - 1 - i}`;
    if (llevada > 0) {
      pasosColumnas.push(`En las ${posNombre}: sumamos ${da} + ${db} + ${llevada} (llevada) = ${sumaCol}. Dejamos ${sumaCol % 10} y llevamos ${Math.floor(sumaCol / 10)}.`);
    } else {
      pasosColumnas.push(`En las ${posNombre}: sumamos ${da} + ${db} = ${sumaCol}. Dejamos ${sumaCol % 10} y llevamos ${Math.floor(sumaCol / 10)}.`);
    }
    llevada = Math.floor(sumaCol / 10);
  }
  if (llevada > 0) {
    pasosColumnas.push(`Bajamos la última llevada: ${llevada}.`);
  }

  return {
    operacion: 'suma',
    resultadoExacto: resFmt,
    lecturaPalabras: `${resFmt} (${numeroALetras(suma)})`,
    metodoPrincipal: {
      nombre: 'Algoritmo en columnas con reagrupación',
      pasos: pasosColumnas
    },
    otrosMetodos: [
      {
        nombre: 'Descomposición por valor posicional',
        pasos: [
          `Descomponemos ambos sumandos por su valor posicional.`,
          `Sumamos los bloques correspondientes para obtener ${resFmt}.`
        ]
      },
      {
        nombre: 'Cálculo mental por compensación',
        pasos: [
          `Aproximamos a la decena o centena más cercana y ajustamos la diferencia.`,
          `Resultado verificado: ${resFmt}.`
        ]
      }
    ],
    prueba: `Operación inversa (resta): ${resFmt} − ${bFmt} = ${aFmt}`
  };
}

export function resolverResta(aStr, bStr, opciones = {}) {
  const numA = interpretarNumero(aStr);
  const numB = interpretarNumero(bStr);
  const a = numA.valor;
  const b = numB.valor;
  const resta = a - b;
  const aFmt = formatearMiles(a.toString());
  const bFmt = formatearMiles(b.toString());
  const resFmt = formatearMiles(resta.toString());

  return {
    operacion: 'resta',
    resultadoExacto: resFmt,
    lecturaPalabras: `${resFmt} (${numeroALetras(resta)})`,
    metodoPrincipal: {
      nombre: 'Algoritmo en columnas con préstamo (atravesando ceros)',
      pasos: [
        `Colocamos el minuendo ${aFmt} y debajo el sustraendo ${bFmt} alineados por la derecha.`,
        `Al restar dígitos menores, pedimos prestado a la columna siguiente (desagrupando los ceros intermedios a 9 y el primer dígito no nulo).`,
        `Realizamos las restas columna por columna hasta obtener ${resFmt}.`
      ]
    },
    otrosMetodos: [
      {
        nombre: 'Conteo ascendente (hacia arriba)',
        pasos: [
          `Comenzamos en ${bFmt} y contamos lo que falta para llegar a ${aFmt}.`,
          `Suma total de saltos = ${resFmt}.`
        ]
      }
    ],
    prueba: `Operación inversa (suma): ${resFmt} + ${bFmt} = ${aFmt}`
  };
}

export function resolverMultiplicacion(aStr, bStr, opciones = {}) {
  const numA = interpretarNumero(aStr);
  const numB = interpretarNumero(bStr);
  const a = numA.valor;
  const b = numB.valor;
  const prod = a * b;
  const aFmt = formatearMiles(a.toString());
  const bFmt = formatearMiles(b.toString());
  const resFmt = formatearMiles(prod.toString());

  const sB = b.toString();
  const parciales = [];
  for (let i = sB.length - 1; i >= 0; i--) {
    const digito = BigInt(sB[i]);
    const parcial = a * digito;
    parciales.push(`${aFmt} × ${digito} = ${formatearMiles(parcial.toString())}`);
  }

  return {
    operacion: 'multiplicacion',
    resultadoExacto: resFmt,
    lecturaPalabras: `${resFmt} (${numeroALetras(prod)})`,
    metodoPrincipal: {
      nombre: 'Algoritmo estándar de multiplicación (productos parciales)',
      pasos: [
        `Multiplicamos el primer factor ${aFmt} por cada dígito del segundo factor ${bFmt}:`,
        ...parciales,
        `Sumamos los productos parciales alineados: ${resFmt}.`
      ]
    },
    otrosMetodos: [
      {
        nombre: 'Descomposición por valor posicional (modelo de áreas)',
        pasos: [
          `Descomponemos ambos factores en centenas, decenas y unidades.`,
          `Multiplicamos cada bloque y sumamos las áreas resultantes: ${resFmt}.`
        ]
      },
      {
        nombre: 'Multiplicación por celosía (rejilla)',
        pasos: [
          `Distribuimos los dígitos en una cuadrícula con diagonales.`,
          `Multiplicamos casillas y sumamos por las diagonales: ${resFmt}.`
        ]
      }
    ],
    prueba: `Operación inversa (división): ${resFmt} ÷ ${bFmt} = ${aFmt}`
  };
}

export function resolverDivision(aStr, bStr, opciones = {}) {
  const numA = interpretarNumero(aStr);
  const numB = interpretarNumero(bStr);
  const a = numA.valor;
  const b = numB.valor;

  if (b === 0n) {
    return {
      operacion: 'division',
      resultadoExacto: 'Indefinida',
      error: 'DIVISION_POR_CERO',
      explicacion: 'La división entre cero no está definida en matemáticas. No es posible repartir una cantidad entre cero personas o grupos.'
    };
  }

  const cociente = a / b;
  const residuo = a % b;
  const aFmt = formatearMiles(a.toString());
  const bFmt = formatearMiles(b.toString());
  const cocFmt = formatearMiles(cociente.toString());
  const resFmt = formatearMiles(residuo.toString());

  return {
    operacion: 'division',
    resultadoExacto: residuo === 0n ? cocFmt : `${cocFmt} (residuo ${resFmt})`,
    cociente: cocFmt,
    residuo: resFmt,
    cocienteBigInt: cociente,
    residuoBigInt: residuo,
    lecturaPalabras: `${cocFmt}${residuo === 0n ? '' : ` con residuo ${resFmt}`}`,
    metodoPrincipal: {
      nombre: 'Algoritmo de la división larga con restas sucesivas',
      pasos: [
        `Dividimos ${aFmt} entre ${bFmt}:`,
        `Determinamos cuántas veces cabe ${bFmt} en las cifras iniciales del dividendo.`,
        `Cociente obtenido: ${cocFmt}.`,
        `Residuo final: ${resFmt}.`
      ]
    },
    otrosMetodos: [
      {
        nombre: 'Reparto equitativo / restas sucesivas',
        pasos: [
          `Restamos sucesivamente grupos de ${bFmt} del total ${aFmt}.`,
          `Pudimos restar ${bFmt} un total de ${cocFmt} veces, sobrando ${resFmt}.`
        ]
      }
    ],
    prueba: `Comprobación: (${cocFmt} × ${bFmt}) + ${resFmt} = ${aFmt}`
  };
}

export function resolverFracciones(aStr, operador, bStr) {
  const fA = Fraccion.fromString(aStr);
  const fB = Fraccion.fromString(bStr);
  let resF;
  let opNombre = '';

  if (operador === '+' || operador === 'suma') {
    resF = fA.sumar(fB);
    opNombre = 'Suma de fracciones';
  } else if (operador === '-' || operador === 'resta') {
    resF = fA.restar(fB);
    opNombre = 'Resta de fracciones';
  } else if (operador === '*' || operador === '×' || operador === 'multiplica') {
    resF = fA.multiplicar(fB);
    opNombre = 'Multiplicación de fracciones';
  } else if (operador === '/' || operador === '÷' || operador === 'divide') {
    resF = fA.dividir(fB);
    opNombre = 'División de fracciones';
  } else {
    resF = fA.sumar(fB);
    opNombre = 'Suma de fracciones';
  }

  const mcmDen = mcmBigInt(fA.den, fB.den);
  const mixto = resF.toMixtoString();

  return {
    operacion: 'fracciones',
    resultadoExacto: resF.toString(),
    numeroMixto: mixto,
    resultadoDecimal: resF.toDecimalString(),
    fraccion: resF,
    metodoPrincipal: {
      nombre: `${opNombre} usando Mínimo Común Múltiplo (MCM)`,
      pasos: [
        `Identificamos los denominadores: ${fA.den} y ${fB.den}. El MCM es ${mcmDen}.`,
        `Convertimos a fracciones equivalentes con denominador ${mcmDen}:`,
        `${fA.toString()} = ${(fA.num * (mcmDen / fA.den))}/${mcmDen}`,
        `${fB.toString()} = ${(fB.num * (mcmDen / fB.den))}/${mcmDen}`,
        `Operamos los numeradores manteniendo el denominador: ${resF.toString()}${mixto !== resF.toString() ? ` = ${mixto}` : ''}.`
      ]
    },
    otrosMetodos: [
      {
        nombre: 'Método de productos cruzados (mariposa)',
        pasos: [
          `Multiplicamos en cruz los numeradores y denominadores: (${fA.num} × ${fB.den}) y (${fB.num} × ${fA.den}).`,
          `Multiplicamos los denominadores directos: ${fA.den} × ${fB.den}.`,
          `Simplificamos la fracción resultante a su mínima expresión: ${resF.toString()}.`
        ]
      }
    ],
    prueba: `Simplificación verificada irreducible: MCD(${resF.num}, ${resF.den}) = 1.`
  };
}

export function resolverPorcentaje(porcStr, totalStr) {
  const p = interpretarNumero(porcStr).valor;
  const t = interpretarNumero(totalStr).valor;
  const prod = p * t;
  const resultado = prod / 100n;
  const residuo = prod % 100n;

  const resExacto = residuo === 0n ? resultado.toString() : `${resultado},${residuo.toString().padStart(2, '0')}`;

  return {
    operacion: 'porcentaje',
    resultadoExacto: resExacto,
    fraccion: new Fraccion(prod, 100n),
    metodoPrincipal: {
      nombre: 'Regla de tres simple directa',
      pasos: [
        `Si el 100% representa ${totalStr}, planteamos la proporción:`,
        `100% ----> ${totalStr}`,
        `${porcStr}% ----> x`,
        `x = (${porcStr} × ${totalStr}) ÷ 100 = ${prod} ÷ 100 = ${resExacto}`
      ]
    },
    otrosMetodos: [
      {
        nombre: 'Cálculo mental con 10% y sus múltiplos',
        pasos: [
          `Calculamos el 10% dividiendo entre 10: ${totalStr} ÷ 10 = ${t / 10n}.`,
          `Multiplicamos ese valor por ${p / 10n} para alcanzar el ${porcStr}%: resultado = ${resExacto}.`
        ]
      },
      {
        nombre: 'Fracción decimal equivalente',
        pasos: [
          `Expresamos ${porcStr}% como fracción decimal: ${porcStr}/100.`,
          `Multiplicamos la fracción por el total: (${porcStr}/100) × ${totalStr} = ${resExacto}.`
        ]
      }
    ],
    prueba: `Comprobación: (${resExacto} ÷ ${totalStr}) × 100 = ${porcStr}%`
  };
}

export function resolverPotencia(baseStr, expStr) {
  const b = interpretarNumero(baseStr).valor;
  const e = interpretarNumero(expStr).valor;
  if (e < 0n) throw new Error('EXPONENTE_NEGATIVO: Primaria no contempla exponentes negativos.');
  const res = b ** e;
  const resFmt = formatearMiles(res.toString());

  const factores = Array(Number(e)).fill(baseStr).join(' × ');

  return {
    operacion: 'potencia',
    resultadoExacto: resFmt,
    resultadoBigInt: res,
    lecturaPalabras: `${resFmt} (${numeroALetras(res)})`,
    metodoPrincipal: {
      nombre: 'Definición de potenciación como producto de factores iguales',
      pasos: [
        `La base es ${baseStr} y el exponente es ${expStr}.`,
        `Multiplicamos la base por sí misma tantas veces como indica el exponente:`,
        `${baseStr}^${expStr} = ${factores} = ${resFmt}`
      ]
    },
    otrosMetodos: [
      {
        nombre: 'Agrupación de productos parciales',
        pasos: [
          `Agrupamos multiplicaciones de 2 en 2 para simplificar el cálculo mental.`,
          `Resultado final: ${resFmt}.`
        ]
      }
    ],
    prueba: `Operación inversa (radicación): Raíz ${expStr}-ésima de ${resFmt} = ${baseStr}`
  };
}

export function resolverGeometria(tipo, parametros = {}) {
  if (tipo === 'rectangulo') {
    const b = interpretarNumero(parametros.base || parametros.b || 0).valor;
    const h = interpretarNumero(parametros.altura || parametros.h || 0).valor;
    const area = b * h;
    const perimetro = 2n * (b + h);
    const unidad = parametros.unidad || 'cm';
    return {
      figura: 'Rectángulo',
      area: `${formatearMiles(area.toString())} ${unidad}²`,
      perimetro: `${formatearMiles(perimetro.toString())} ${unidad}`,
      pasosArea: [
        `Fórmula del área: A = base × altura`,
        `Sustitución: A = ${b} ${unidad} × ${h} ${unidad}`,
        `Cálculo: A = ${area} ${unidad}²`
      ],
      pasosPerimetro: [
        `Fórmula del perímetro: P = 2 × (base + altura)`,
        `Sustitución: P = 2 × (${b} + ${h}) = 2 × ${b + h}`,
        `Cálculo: P = ${perimetro} ${unidad}`
      ]
    };
  }

  if (tipo === 'cubo') {
    const a = interpretarNumero(parametros.arista || parametros.lado || 0).valor;
    const vol = a ** 3n;
    const unidad = parametros.unidad || 'cm';
    return {
      figura: 'Cubo',
      volumen: `${formatearMiles(vol.toString())} ${unidad}³`,
      pasosVolumen: [
        `Fórmula del volumen de un cubo: V = arista³`,
        `Sustitución: V = ${a}³ = ${a} × ${a} × ${a}`,
        `Cálculo: V = ${vol} ${unidad}³`
      ]
    };
  }

  throw new Error(`Figura geométrica no reconocida: ${tipo}`);
}

// ============================================================================
// 5. PARSEADOR GENERAL DE CONSULTA MATEMÁTICA
// ============================================================================

export function procesarConsultaMatematica(texto) {
  if (!texto || typeof texto !== 'string') return null;
  const t = texto.trim();

  // Números en letras: "escribe 4.835 en letras"
  const mEscribeLetras = t.match(/escribe\s+([0-9\.,]+)\s+en\s+letras/i);
  if (mEscribeLetras) {
    const num = interpretarNumero(mEscribeLetras[1]).valor;
    return {
      tipo: 'letras',
      cifras: mEscribeLetras[1],
      letras: numeroALetras(num),
      respuesta: `El número ${mEscribeLetras[1]} se escribe en letras: **${numeroALetras(num)}**.`
    };
  }

  // Cifras desde letras: "escribe en cifras: dos mil trescientos cuarenta y uno"
  const mEscribeCifras = t.match(/escribe\s+en\s+cifras:?\s*([a-záéíóúñ\s]+)/i);
  if (mEscribeCifras) {
    const val = letrasANumero(mEscribeCifras[1]);
    const valFmt = formatearMiles(val.toString());
    return {
      tipo: 'cifras',
      letras: mEscribeCifras[1].trim(),
      cifras: val.toString(),
      cifrasFormateadas: valFmt,
      respuesta: `El texto "${mEscribeCifras[1].trim()}" corresponde a la cifra: **${valFmt}** (${val.toString()}).`
    };
  }

  // Área o volumen
  if (/área\s+de\s+un\s+rect[aá]ngulo/i.test(t)) {
    const mRect = t.match(/(\d+)\s*(cm|m|mm)?\s*(?:por|x|×)\s*(\d+)\s*(cm|m|mm)?/i);
    if (mRect) {
      const b = mRect[1];
      const h = mRect[3];
      const u = mRect[2] || mRect[4] || 'cm';
      const geo = resolverGeometria('rectangulo', { base: b, altura: h, unidad: u });
      return {
        tipo: 'geometria',
        resultado: geo.area,
        respuesta: `📐 **Área del Rectángulo:**\n${geo.pasosArea.join('\n')}`
      };
    }
  }

  if (/volumen\s+de\s+un\s+cubo/i.test(t)) {
    const mCubo = t.match(/(?:arista|lado)\s+(\d+)/i);
    if (mCubo) {
      const a = mCubo[1];
      const geo = resolverGeometria('cubo', { arista: a, unidad: 'cm' });
      return {
        tipo: 'geometria',
        resultado: geo.volumen,
        respuesta: `📦 **Volumen del Cubo:**\n${geo.pasosVolumen.join('\n')}`
      };
    }
  }

  // Fracciones: "3/4 + 5/6"
  const mFrac = t.match(/(\d+\/\d+)\s*([\+\-\*×÷\/])\s*(\d+\/\d+)/);
  if (mFrac) {
    const res = resolverFracciones(mFrac[1], mFrac[2], mFrac[3]);
    return {
      tipo: 'fracciones',
      resultado: res.resultadoExacto,
      respuesta: `🔢 **${res.metodoPrincipal.nombre}:**\n` +
        res.metodoPrincipal.pasos.join('\n') +
        `\n\n💡 **Otro método:** ${res.otrosMetodos[0].nombre}\n` +
        res.otrosMetodos[0].pasos.join('\n') +
        `\n\n✅ ${res.prueba}`
    };
  }

  // Porcentajes: "20 % de 350"
  const mPorc = t.match(/(\d+)\s*%\s*(?:de)\s*([0-9\.,]+)/i);
  if (mPorc) {
    const res = resolverPorcentaje(mPorc[1], mPorc[2]);
    return {
      tipo: 'porcentaje',
      resultado: res.resultadoExacto,
      respuesta: `📊 **Cálculo de Porcentaje:**\n` +
        res.metodoPrincipal.pasos.join('\n') +
        `\n\n💡 **Otro método (${res.otrosMetodos[0].nombre}):**\n` +
        res.otrosMetodos[0].pasos.join('\n')
    };
  }

  // Potencias: "2 elevado a 5" o "2^5"
  const mPot = t.match(/(\d+)\s*(?:elevado\s+a\s+|\^)\s*(\d+)/i);
  if (mPot) {
    const res = resolverPotencia(mPot[1], mPot[2]);
    return {
      tipo: 'potencia',
      resultado: res.resultadoExacto,
      respuesta: `⚡ **Potenciación:**\n` +
        res.metodoPrincipal.pasos.join('\n') +
        `\n\n✅ ${res.prueba}`
    };
  }

  // Suma
  const mSuma = t.match(/(?:cu[aá]nto\s+es\s+|suma\s+)?([0-9\.,]+)\s*[\+]\s*([0-9\.,]+)/i);
  if (mSuma) {
    const res = resolverSuma(mSuma[1], mSuma[2]);
    return {
      tipo: 'suma',
      resultado: res.resultadoExacto,
      respuesta: `➕ **Suma (${res.metodoPrincipal.nombre}):**\n` +
        res.metodoPrincipal.pasos.join('\n') +
        `\n\nResultado: **${res.resultadoExacto}**\n` +
        `En palabras: *${res.lecturaPalabras}*\n\n` +
        `💡 **Otro método (${res.otrosMetodos[0].nombre}):**\n` +
        res.otrosMetodos[0].pasos.join('\n') +
        `\n\n✅ ${res.prueba}`
    };
  }

  // Resta
  const mResta = t.match(/(?:cu[aá]nto\s+es\s+|resta\s+)?([0-9\.,]+)\s*[\-−]\s*([0-9\.,]+)/i);
  if (mResta) {
    const res = resolverResta(mResta[1], mResta[2]);
    return {
      tipo: 'resta',
      resultado: res.resultadoExacto,
      respuesta: `➖ **Resta (${res.metodoPrincipal.nombre}):**\n` +
        res.metodoPrincipal.pasos.join('\n') +
        `\n\nResultado: **${res.resultadoExacto}**\n` +
        `En palabras: *${res.lecturaPalabras}*\n\n` +
        `💡 **Otro método (${res.otrosMetodos[0].nombre}):**\n` +
        res.otrosMetodos[0].pasos.join('\n') +
        `\n\n✅ ${res.prueba}`
    };
  }

  // Multiplicación
  const mMult = t.match(/(?:cu[aá]nto\s+es\s+|multiplica\s+)?([0-9\.,]+)\s*[\*×x]\s*([0-9\.,]+)/i);
  if (mMult) {
    const res = resolverMultiplicacion(mMult[1], mMult[2]);
    return {
      tipo: 'multiplicacion',
      resultado: res.resultadoExacto,
      respuesta: `✖️ **Multiplicación (${res.metodoPrincipal.nombre}):**\n` +
        res.metodoPrincipal.pasos.join('\n') +
        `\n\nResultado: **${res.resultadoExacto}**\n` +
        `En palabras: *${res.lecturaPalabras}*\n\n` +
        `💡 **Otro método (${res.otrosMetodos[0].nombre}):**\n` +
        res.otrosMetodos[0].pasos.join('\n') +
        `\n\n✅ ${res.prueba}`
    };
  }

  // División
  const mDiv = t.match(/(?:cu[aá]nto\s+es\s+|divide\s+)?([0-9\.,]+)\s*[\/÷:]\s*([0-9\.,]+)/i);
  if (mDiv) {
    const res = resolverDivision(mDiv[1], mDiv[2]);
    if (res.error) {
      return {
        tipo: 'division_error',
        resultado: res.resultadoExacto,
        respuesta: `⚠️ **${res.resultadoExacto}:** ${res.explicacion}`
      };
    }
    return {
      tipo: 'division',
      resultado: res.resultadoExacto,
      respuesta: `➗ **División (${res.metodoPrincipal.nombre}):**\n` +
        res.metodoPrincipal.pasos.join('\n') +
        `\n\nResultado: **${res.resultadoExacto}**\n\n` +
        `✅ ${res.prueba}`
    };
  }

  return null;
}
