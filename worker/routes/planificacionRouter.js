/**
 * Enrutador Modular de Planificación Didáctica para el Cloudflare Worker
 * Conecta las rutas de planificación con el motor autónomo CerebroRobot y AuditorPedagogico.
 */
import { manejarSolicitudPlanificacion } from './manejadorPlanificacion.js';

export async function planificacionRouter(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Rutas canónicas para generación de planificación didáctica
  const rutasPlanificacion = [
    '/api/planificar',
    '/api/planificar-clase',
    '/api/plan/generate',
    '/api/plan'
  ];

  if (rutasPlanificacion.includes(path)) {
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-device-id, x-app-key'
        }
      });
    }

    return await manejarSolicitudPlanificacion(request, env);
  }

  return null;
}

export { manejarSolicitudPlanificacion };
export default {
  async fetch(request, env) {
    const res = await planificacionRouter(request, env);
    if (res) return res;
    return new Response(JSON.stringify({ error: 'Ruta no encontrada en el router de planificación' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};
