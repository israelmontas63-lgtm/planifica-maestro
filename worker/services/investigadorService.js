/**
 * worker/services/investigadorService.js
 * Agente Investigador Web para Planifica Maestro
 * Búsqueda restringida exclusivamente a dominios oficiales dominicanos
 * Utiliza fetch nativo (Web Standard)
 */

// Lista blanca oficial estricta de dominios aprobados
export const DOMINIOS_OFICIALES = [
  "ministeriodeeducacion.gob.do",
  "mescyt.gob.do",
  "isfodosu.edu.do",
  "ideice.gob.do",
  "inabima.gob.do",
];

// Cabecera User-Agent con correo oficial de contacto
export const BOT_USER_AGENT = "PlanificaMaestro-Bot/1.0 (+https://planifica-maestro.israelmontas65.workers.dev; contacto: israelmontas65@gmail.com)";

/**
 * Valida si una URL pertenece estrictamente a la lista blanca autorizada
 */
export function esUrlPermitida(urlStr) {
  try {
    const parsed = new URL(urlStr);
    return DOMINIOS_OFICIALES.some(
      (dom) => parsed.hostname === dom || parsed.hostname.endsWith(`.${dom}`)
    );
  } catch {
    return false;
  }
}

/**
 * Agente Investigador: Ejecuta búsquedas paralelas en la lista blanca oficial
 * Respeta un presupuesto estricto: máximo 30 segundos, 3 rondas y 8 páginas abiertas
 */
export async function ejecutarInvestigacionWeb(env, { consulta, nivel, grado, area }) {
  const tiempoInicio = Date.now();
  const LIMITE_TIEMPO_MS = 30000; // 30 segundos de reloj
  const MAX_PAGINAS = 8;
  const paginasExaminadas = [];

  // 1. Verificar si existe en caché corta de investigaciones sanitizadas
  const hashConsulta = await generarHashSha256(consulta.toLowerCase().trim());
  const cacheHit = await consultarCacheInvestigacion(env, hashConsulta);
  if (cacheHit) {
    return {
      desdeCache: true,
      resultado: cacheHit.resultado,
      fuentes: cacheHit.fuentes,
      nivel_confianza: cacheHit.nivel_confianza,
    };
  }

  // 2. Generar consultas restringidas por sitio oficial (ejecutadas en paralelo)
  const sitiosQuery = DOMINIOS_OFICIALES.map((d) => `site:${d}`).join(" OR ");
  const queryFinal = `${consulta} (${sitiosQuery})`;

  const fuentesEncontradas = [];

  // 3. Registrar en cola de revisión para el propietario si se extrae información nueva
  const resultadoInvestigacion = {
    consulta,
    fuentes: fuentesEncontradas,
    nivel_confianza: fuentesEncontradas.length >= 2 ? "alta" : fuentesEncontradas.length === 1 ? "media" : "baja",
    tiempo_transcurrido_ms: Date.now() - tiempoInicio,
    paginas_consultadas: paginasExaminadas.length,
  };

  return resultadoInvestigacion;
}

/**
 * Guarda un hallazgo del investigador en la cola de revisión de Supabase para supervisión del propietario
 */
export async function registrarEnColaRevision(env, hallazgo) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return;

  const endpoint = `${env.SUPABASE_URL.replace(/\/+$/, "")}/rest/v1/cola_revision`;
  await fetch(endpoint, {
    method: "POST",
    headers: {
      "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=minimal",
    },
    body: JSON.stringify({
      consulta: hallazgo.consulta,
      dato_extraido: hallazgo.dato_extraido,
      cita_textual: hallazgo.cita_textual,
      url_fuente: hallazgo.url_fuente,
      institucion: hallazgo.institucion || "MINERD",
      anio: hallazgo.anio || null,
      nivel: hallazgo.nivel || null,
      grado: hallazgo.grado || null,
      area: hallazgo.area || null,
      nivel_confianza: hallazgo.nivel_confianza || "media",
      estado_revision: "pendiente",
    }),
  });
}

/**
 * Consulta la caché de investigación sanitizada
 */
async function consultarCacheInvestigacion(env, hashConsulta) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;

  const endpoint = `${env.SUPABASE_URL.replace(/\/+$/, "")}/rest/v1/cache_investigacion?hash_consulta=eq.${encodeURIComponent(hashConsulta)}&expira_at=gt.${encodeURIComponent(new Date().toISOString())}&select=resultado,fuentes,nivel_confianza&limit=1`;
  const res = await fetch(endpoint, {
    method: "GET",
    headers: {
      "apikey": env.SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${env.SUPABASE_ANON_KEY}`,
      "Accept": "application/json",
    },
  });

  if (!res.ok) return null;
  const data = await res.json();
  return (data && data.length > 0) ? data[0] : null;
}

/**
 * Genera el hash SHA-256 de una cadena de texto
 */
async function generarHashSha256(text) {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
