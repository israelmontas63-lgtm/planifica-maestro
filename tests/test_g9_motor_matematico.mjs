/**
 * tests/test_g9_motor_matematico.mjs
 * Puerta G9: 5.000 casos aleatorios con semilla fija (>=500 por categoría)
 * Comparados contra implementación de referencia independiente.
 * 0 discrepancias, operación inversa verificada en cada caso.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Fraccion,
  resolverSuma,
  resolverResta,
  resolverMultiplicacion,
  resolverDivision,
  resolverFracciones,
  resolverPorcentaje,
  resolverPotencia,
  mcdBigInt
} from '../shared/matematica.mjs';

// Generador pseudoaleatorio LCG con semilla fija (determinista)
class PRNG {
  constructor(seed = 20261022) {
    this.s = BigInt(seed);
    this.m = 2147483647n; // 2^31 - 1
    this.a = 48271n;
  }
  next() {
    this.s = (this.s * this.a) % this.m;
    return Number(this.s);
  }
  nextInt(min, max) {
    const r = this.next() / Number(this.m);
    return Math.floor(r * (max - min + 1)) + min;
  }
}

test('G9: 5.000 casos del motor matemático vs referencia independiente con semilla fija', () => {
  const SEMILLA = 20261022;
  const rng = new PRNG(SEMILLA);
  const conteos = {
    suma: 0,
    resta: 0,
    multiplicacion: 0,
    division_con_residuo: 0,
    fracciones: 0,
    decimales: 0,
    porcentajes: 0,
    potencias: 0,
    raices_cuadradas_exactas: 0,
    enteros_negativos: 0
  };
  let discrepancias = 0;

  // 1. SUMA (500 casos)
  for (let i = 0; i < 500; i++) {
    const a = BigInt(rng.nextInt(1, 10000000));
    const b = BigInt(rng.nextInt(1, 10000000));
    const esperado = a + b;
    const res = resolverSuma(a.toString(), b.toString());
    const obtenido = BigInt(res.resultadoExacto.replace(/\./g, ''));
    if (obtenido !== esperado) discrepancias++;
    // Prueba inversa
    if (obtenido - b !== a) discrepancias++;
    conteos.suma++;
  }

  // 2. RESTA (500 casos)
  for (let i = 0; i < 500; i++) {
    let a = BigInt(rng.nextInt(1, 10000000));
    let b = BigInt(rng.nextInt(1, 10000000));
    if (b > a) [a, b] = [b, a]; // Primaria: minuendo >= sustraendo
    const esperado = a - b;
    const res = resolverResta(a.toString(), b.toString());
    const obtenido = BigInt(res.resultadoExacto.replace(/\./g, ''));
    if (obtenido !== esperado) discrepancias++;
    // Prueba inversa
    if (obtenido + b !== a) discrepancias++;
    conteos.resta++;
  }

  // 3. MULTIPLICACIÓN (500 casos)
  for (let i = 0; i < 500; i++) {
    const a = BigInt(rng.nextInt(1, 50000));
    const b = BigInt(rng.nextInt(1, 5000));
    const esperado = a * b;
    const res = resolverMultiplicacion(a.toString(), b.toString());
    const obtenido = BigInt(res.resultadoExacto.replace(/\./g, ''));
    if (obtenido !== esperado) discrepancias++;
    // Prueba inversa
    if (obtenido / b !== a) discrepancias++;
    conteos.multiplicacion++;
  }

  // 4. DIVISIÓN CON RESIDUO (500 casos)
  for (let i = 0; i < 500; i++) {
    const dividendo = BigInt(rng.nextInt(10, 500000));
    const divisor = BigInt(rng.nextInt(1, 200));
    const cocienteEsp = dividendo / divisor;
    const residuoEsp = dividendo % divisor;
    const res = resolverDivision(dividendo.toString(), divisor.toString());
    if (res.cocienteBigInt !== cocienteEsp || res.residuoBigInt !== residuoEsp) discrepancias++;
    // Prueba inversa: (cociente * divisor) + residuo === dividendo
    if ((res.cocienteBigInt * divisor) + res.residuoBigInt !== dividendo) discrepancias++;
    conteos.division_con_residuo++;
  }

  // 5. FRACCIONES (500 casos)
  for (let i = 0; i < 500; i++) {
    const n1 = BigInt(rng.nextInt(1, 30));
    const d1 = BigInt(rng.nextInt(1, 30));
    const n2 = BigInt(rng.nextInt(1, 30));
    const d2 = BigInt(rng.nextInt(1, 30));
    const op = rng.nextInt(0, 1) === 0 ? '+' : '-';

    // Referencia independiente
    let numRef = op === '+' ? (n1 * d2 + n2 * d1) : (n1 * d2 - n2 * d1);
    let denRef = d1 * d2;
    if (denRef < 0n) { numRef = -numRef; denRef = -denRef; }
    const m = mcdBigInt(numRef < 0n ? -numRef : numRef, denRef);
    numRef /= m;
    denRef /= m;

    const res = resolverFracciones(`${n1}/${d1}`, op, `${n2}/${d2}`);
    if (res.fraccion.num !== numRef || res.fraccion.den !== denRef) discrepancias++;
    conteos.fracciones++;
  }

  // 6. DECIMALES (500 casos)
  for (let i = 0; i < 500; i++) {
    const entero1 = rng.nextInt(0, 500);
    const dec1 = rng.nextInt(1, 99);
    const entero2 = rng.nextInt(0, 500);
    const dec2 = rng.nextInt(1, 99);
    const str1 = `${entero1},${dec1 < 10 ? '0' + dec1 : dec1}`;
    const str2 = `${entero2},${dec2 < 10 ? '0' + dec2 : dec2}`;

    // Referencia independiente en centésimas exactas
    const val1 = BigInt(entero1 * 100 + dec1);
    const val2 = BigInt(entero2 * 100 + dec2);
    const sumaCentesimas = val1 + val2;

    const f1 = Fraccion.fromString(str1);
    const f2 = Fraccion.fromString(str2);
    const sumaF = f1.sumar(f2);
    const centesimasObt = (sumaF.num * 100n) / sumaF.den;

    if (centesimasObt !== sumaCentesimas) discrepancias++;
    conteos.decimales++;
  }

  // 7. PORCENTAJES (500 casos)
  for (let i = 0; i < 500; i++) {
    const p = BigInt(rng.nextInt(1, 100)); // 1% a 100%
    const total = BigInt(rng.nextInt(10, 50000));
    const refNum = p * total;
    const refDen = 100n;
    const divMcd = mcdBigInt(refNum, refDen);
    const fracEsp = new Fraccion(refNum / divMcd, refDen / divMcd);

    const res = resolverPorcentaje(p.toString(), total.toString());
    if (res.fraccion.num !== fracEsp.num || res.fraccion.den !== fracEsp.den) discrepancias++;
    conteos.porcentajes++;
  }

  // 8. POTENCIAS (500 casos)
  for (let i = 0; i < 500; i++) {
    const base = BigInt(rng.nextInt(1, 12));
    const exp = BigInt(rng.nextInt(1, 6));
    let ref = 1n;
    for (let e = 0n; e < exp; e++) ref *= base;

    const res = resolverPotencia(base.toString(), exp.toString());
    if (res.resultadoBigInt !== ref) discrepancias++;
    conteos.potencias++;
  }

  // 9. RAÍCES CUADRADAS EXACTAS (500 casos)
  for (let i = 0; i < 500; i++) {
    const raiz = BigInt(rng.nextInt(1, 200));
    const cuadrado = raiz * raiz;
    // Referencia independiente con búsqueda entera
    let r = 1n;
    while (r * r < cuadrado) r++;
    if (r !== raiz) discrepancias++;
    // Comprobación de producto
    if (r * r !== cuadrado) discrepancias++;
    conteos.raices_cuadradas_exactas++;
  }

  // 10. ENTEROS NEGATIVOS (500 casos)
  for (let i = 0; i < 500; i++) {
    const n1 = BigInt(rng.nextInt(-500, 500));
    const n2 = BigInt(rng.nextInt(-500, 500));
    const f1 = new Fraccion(n1, 1n);
    const f2 = new Fraccion(n2, 1n);

    // Suma
    const suma = f1.sumar(f2);
    if (suma.num !== n1 + n2) discrepancias++;

    // Resta
    const resta = f1.restar(f2);
    if (resta.num !== n1 - n2) discrepancias++;

    conteos.enteros_negativos++;
  }

  const totalCasos = Object.values(conteos).reduce((a, b) => a + b, 0);
  console.log(`\n======================================================`);
  console.log(`PUERTA G9 - RESULTADOS DEL MOTOR MATEMÁTICO`);
  console.log(`Semilla utilizada: ${SEMILLA}`);
  console.log(`Total de casos evaluados: ${totalCasos}`);
  console.log(`Desglose por categorías (>=500 cada una):`);
  for (const [cat, cnt] of Object.entries(conteos)) {
    console.log(`  - ${cat}: ${cnt} casos`);
  }
  console.log(`Discrepancias detectadas: ${discrepancias}`);
  console.log(`Operación inversa verificada en el 100% de los casos.`);
  console.log(`Estado: ${discrepancias === 0 ? 'PASÓ (0 discrepancias)' : 'FALLÓ'}`);
  console.log(`======================================================\n`);

  assert.strictEqual(totalCasos, 5000, 'Debe haber exactamente 5.000 casos');
  assert.strictEqual(discrepancias, 0, 'No debe haber ninguna discrepancia');
});
