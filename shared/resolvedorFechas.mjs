// Resolvedor de fechas relativas en lenguaje natural para America/Santo_Domingo.
// America/Santo_Domingo es UTC-4 permanente (sin horario de verano), por eso se usa un desfase fijo.
// Módulo puro y determinista: no lee el reloj; "ahora" siempre llega por parámetro.

export const ZONA_HORARIA = "America/Santo_Domingo";

const OFFSET_UTC_MS = 4 * 60 * 60 * 1000;
const MIN_MS = 60 * 1000;
const HORA_MS = 60 * MIN_MS;
const MAX_HORAS_ATRAS = 720; // 30 días
const MAX_DIAS_ATRAS = 365;
const MAX_SEMANAS_ATRAS = 52;
const TOLERANCIA_MINIMA_MS = 10 * MIN_MS;

const NUMEROS = {
  cero: 0, un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
};

const DIAS_SEMANA = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6,
};

function fechaValida(f) {
  return f instanceof Date && !Number.isNaN(f.getTime());
}

// Componentes del calendario local de RD (año, mes 0-11, día, día de semana 0=domingo).
function componentesLocales(ahora) {
  const l = new Date(ahora.getTime() - OFFSET_UTC_MS);
  return { y: l.getUTCFullYear(), m: l.getUTCMonth(), d: l.getUTCDate(), dow: l.getUTCDay() };
}

// Medianoche local de RD expresada en ms UTC (04:00:00.000Z). Date.UTC normaliza desbordes de día/mes.
function inicioDiaMs(y, m, d) {
  return Date.UTC(y, m, d, 4, 0, 0, 0);
}

function iso(ms) {
  return new Date(ms).toISOString();
}

function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function noReconocida() {
  return {
    reconocida: false,
    desde: null,
    hasta: null,
    alternativas: [],
    aproximado: false,
    futuro: false,
    zona: ZONA_HORARIA,
  };
}

function resultado(ahora, desdeMs, hastaMs, extra = {}) {
  return {
    reconocida: true,
    desde: iso(desdeMs),
    hasta: iso(hastaMs),
    alternativas: (extra.alternativas || []).map(([a, b]) => ({ desde: iso(a), hasta: iso(b) })),
    aproximado: Boolean(extra.aproximado),
    futuro: desdeMs > ahora.getTime(),
    zona: ZONA_HORARIA,
  };
}

// ---- Ayudantes de zona RD reutilizables por worker/ y server/ ----

// "YYYY-MM-DD" del calendario de Santo Domingo.
export function fechaLocalRD(ahora = new Date()) {
  if (!fechaValida(ahora)) throw new TypeError("fechaLocalRD: fecha inválida");
  const { y, m, d } = componentesLocales(ahora);
  return `${String(y).padStart(4, "0")}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// ISO UTC de la próxima medianoche de Santo Domingo.
export function inicioDiaSiguienteRD(ahora = new Date()) {
  if (!fechaValida(ahora)) throw new TypeError("inicioDiaSiguienteRD: fecha inválida");
  const { y, m, d } = componentesLocales(ahora);
  return iso(inicioDiaMs(y, m, d + 1));
}

// ISO UTC del primer día del mes siguiente a las 00:00 de Santo Domingo.
export function inicioMesSiguienteRD(ahora = new Date()) {
  if (!fechaValida(ahora)) throw new TypeError("inicioMesSiguienteRD: fecha inválida");
  const { y, m } = componentesLocales(ahora);
  return iso(Date.UTC(y, m + 1, 1, 4, 0, 0, 0));
}

// ---- Resolvedor principal ----

export function resolverFechaRelativa(texto, ahora = new Date()) {
  if (typeof texto !== "string" || !fechaValida(ahora)) return noReconocida();
  const t = normalizar(texto);
  if (!t) return noReconocida();

  const { y, m, d, dow } = componentesLocales(ahora);
  const ahoraMs = ahora.getTime();
  const hoyIdx = (dow + 6) % 7; // 0 = lunes ... 6 = domingo

  const rDia = (offset, extra) =>
    resultado(ahora, inicioDiaMs(y, m, d + offset), inicioDiaMs(y, m, d + offset + 1), extra);

  const ventanaHace = (lapsoMs) => {
    const punto = ahoraMs - lapsoMs;
    const tol = Math.max(lapsoMs / 2, TOLERANCIA_MINIMA_MS);
    return resultado(ahora, punto - tol, Math.min(punto + tol, ahoraMs), { aproximado: true });
  };

  // 1) "hace ..." (se evalúa primero; si coincide pero es inválido, se rechaza sin seguir)
  if (/\bhace\s+media\s+hora\b/.test(t)) {
    return ventanaHace(30 * MIN_MS);
  }
  const mHace = t.match(
    /\bhace\s+(\d+|cero|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(minutos?|horas?|dias?|semanas?)\b/
  );
  if (mHace) {
    const n = /^\d+$/.test(mHace[1]) ? Number(mHace[1]) : NUMEROS[mHace[1]];
    const unidad = mHace[2];
    if (!Number.isFinite(n) || n < 1) return noReconocida();
    if (unidad.startsWith("minuto")) {
      if (n * MIN_MS > MAX_HORAS_ATRAS * HORA_MS) return noReconocida();
      return ventanaHace(n * MIN_MS);
    }
    if (unidad.startsWith("hora")) {
      if (n > MAX_HORAS_ATRAS) return noReconocida();
      return ventanaHace(n * HORA_MS);
    }
    if (unidad.startsWith("dia")) {
      if (n > MAX_DIAS_ATRAS) return noReconocida();
      return rDia(-n);
    }
    if (n > MAX_SEMANAS_ATRAS) return noReconocida();
    // semana: centrada en el día (hoy - 7n), con ±1 día de tolerancia
    return resultado(
      ahora,
      inicioDiaMs(y, m, d - 7 * n - 1),
      inicioDiaMs(y, m, d - 7 * n + 2),
      { aproximado: true }
    );
  }

  // 2) Día de la semana (antes que "semana pasada" para soportar "el martes de la semana pasada")
  const mDia = t.match(/\b(domingo|lunes|martes|miercoles|jueves|viernes|sabado)\b/);
  if (mDia) {
    const objetivo = DIAS_SEMANA[mDia[1]];
    const objIdx = (objetivo + 6) % 7;
    if (/\bsemana pasada\b/.test(t)) {
      return rDia(-hoyIdx - 7 + objIdx);
    }
    if (/\besta semana\b/.test(t)) {
      return rDia(objIdx - hoyIdx);
    }
    if (/\bpasad[oa]\b/.test(t)) {
      const diff = ((dow - objetivo + 7) % 7) || 7;
      return rDia(-diff);
    }
    const diff = (dow - objetivo + 7) % 7; // si hoy es ese día, devuelve hoy
    const [aDesde, aHasta] = [inicioDiaMs(y, m, d - diff - 7), inicioDiaMs(y, m, d - diff - 6)];
    return rDia(-diff, { alternativas: [[aDesde, aHasta]] });
  }

  // 3) hoy / ayer / anteayer (anteayer primero porque "antes de ayer" contiene "ayer")
  if (/\b(anteayer|antes de ayer)\b/.test(t)) return rDia(-2);
  if (/\bayer\b/.test(t)) return rDia(-1);
  if (/\bhoy\b/.test(t)) return rDia(0);

  // 4) Partes del día de hoy (hora local: mañana 05-12, tarde 12-19, noche 19-24)
  const mParte = t.match(/\besta\s+(manana|tarde|noche)\b/);
  if (mParte) {
    const base = inicioDiaMs(y, m, d);
    if (mParte[1] === "manana") return resultado(ahora, base + 5 * HORA_MS, base + 12 * HORA_MS);
    if (mParte[1] === "tarde") return resultado(ahora, base + 12 * HORA_MS, base + 19 * HORA_MS);
    return resultado(ahora, base + 19 * HORA_MS, base + 24 * HORA_MS);
  }

  // 5) Semanas (lunes a domingo) y meses
  if (/\bsemana pasada\b/.test(t)) {
    return resultado(ahora, inicioDiaMs(y, m, d - hoyIdx - 7), inicioDiaMs(y, m, d - hoyIdx));
  }
  if (/\besta semana\b/.test(t)) {
    return resultado(ahora, inicioDiaMs(y, m, d - hoyIdx), inicioDiaMs(y, m, d - hoyIdx + 7));
  }
  if (/\bmes pasado\b/.test(t)) {
    return resultado(ahora, Date.UTC(y, m - 1, 1, 4, 0, 0, 0), Date.UTC(y, m, 1, 4, 0, 0, 0));
  }
  if (/\beste mes\b/.test(t)) {
    return resultado(ahora, Date.UTC(y, m, 1, 4, 0, 0, 0), Date.UTC(y, m + 1, 1, 4, 0, 0, 0));
  }

  return noReconocida();
}