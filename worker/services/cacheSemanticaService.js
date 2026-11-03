/**
 * worker/services/cacheSemanticaService.js
 * 
 * Capa de Caché Semántica Canónica para Planifica Maestro
 * Almacena y recupera planificaciones validadas por grado, área y tema
 * permitiendo respuestas ultrarrápidas (<60ms) con X-Cache-Status: HIT.
 */

export function generarClaveCache(grado, area, tema) {
  if (!grado || !area || !tema) return null;
  const areaNorm = area.toLowerCase().trim();
  const temaNorm = tema
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[¿?¡!.,:;()\[\]{}"'\\\/_\-]/g, ' ')
    .replace(/\b(el|la|los|las|un|una|unos|unas|de|del|para|sobre|en)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return `${grado}:${areaNorm}:${temaNorm}`;
}

export async function consultarCache(env, claveHash) {
  if (!claveHash || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const url = `${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/rpc/consultar_cache_planificacion`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_clave_hash: claveHash })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  } catch (err) {
    console.warn('[Cache] Error al consultar:', err.message);
    return null;
  }
}

export async function guardarEnCache(env, { claveHash, grado, area, tema, planJson, fuentes }) {
  if (!claveHash || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return;
  const url = `${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/curriculo_cache_semantica?on_conflict=clave_hash`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify({
        clave_hash: claveHash,
        grado: grado,
        area: area,
        tema_consulta: tema,
        plan_json: planJson,
        fuentes_utilizadas: fuentes || []
      })
    });
  } catch (err) {
    console.warn('[Cache] Error al guardar en cache:', err.message);
  }
}
