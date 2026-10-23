// Coincidencia con el TEMA (no con indicadores) y lista de temas sin repetir.
const PARADA = new Set(['para', 'sobre', 'como', 'cual', 'cuales', 'tema', 'temas', 'curriculo', 'curricular', 'oficial', 'grado', 'primero', 'segundo', 'tercero', 'cuarto', 'quinto', 'sexto', 'primaria', 'lengua', 'espanola', 'matematica', 'matematicas', 'ciencias', 'naturaleza', 'naturales', 'sociales', 'artistica', 'fisica', 'ingles', 'formacion', 'humana', 'religiosa', 'educacion', 'dice', 'quiero', 'dame', 'busca', 'buscar', 'favor', 'necesito', 'informacion', 'explica', 'hablame', 'plan', 'planificacion', 'unidad', 'clase', 'desde', 'entre', 'donde', 'cuando', 'tambien']);

export function normalizar(t) {
  return String(t ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

const raiz = (p) => (p.length > 6 ? p.slice(0, 6) : p.replace(/(?:es|s)$/, ''));

export function tokensSignificativos(consulta) {
  return normalizar(consulta).split(' ').filter((p) => p.length >= 4 && !PARADA.has(p));
}

// true si ALGUNA palabra significativa de la consulta aparece (por raíz) en el tema.
// Sin palabras significativas (consulta vacía o solo grado/área) devuelve true: no hay nada que descartar.
export function coincideConTema(consulta, tema) {
  const tokens = tokensSignificativos(consulta);
  if (tokens.length === 0) return true;
  const raices = new Set(normalizar(tema).split(' ').filter((p) => p.length >= 4).map(raiz));
  return tokens.some((t) => raices.has(raiz(t)));
}

export function listarTemasUnicos(filas) {
  const vistos = new Set();
  const temas = [];
  for (const fila of filas ?? []) {
    const t = String(fila?.tema ?? '').trim();
    if (!t) continue;
    const k = normalizar(t);
    if (vistos.has(k)) continue;
    vistos.add(k);
    temas.push(t);
  }
  return temas;
}

export function formatearListaTemas(temas, max = 10) {
  if (!temas.length) return '';
  const mostrar = temas.slice(0, max);
  const resto = temas.length - mostrar.length;
  return mostrar.join(', ') + (resto > 0 ? ` y ${resto} más` : '') + '.';
}

// Lectura REST (solo SELECT) de los temas de un grado y área canónica. Devuelve [] si algo falla.
export async function consultarTemasREST({ url, clave, grado, area, nivel = 'Primario', fetchImpl = fetch, limite = 60 }) {
  if (!url || !clave || !grado || !area) return [];
  const base = String(url).replace(/\/$/, '');
  const q = `${base}/rest/v1/curriculo_secuencias?select=source_id,tema&nivel=eq.${encodeURIComponent(nivel)}&grado_num=eq.${encodeURIComponent(grado)}&area=eq.${encodeURIComponent(area)}&vigente=eq.true&order=source_id.asc&limit=${limite}`;
  try {
    const r = await fetchImpl(q, { headers: { apikey: clave, Authorization: `Bearer ${clave}` } });
    if (!r.ok) return [];
    const filas = await r.json();
    return Array.isArray(filas) ? filas : [];
  } catch {
    return [];
  }
}
