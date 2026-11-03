/**
 * worker/services/memoriaService.js
 * Servicio de Memoria y Persistencia Conversacional para Planifica Maestro
 */

export async function recuperarHistorialSesion(env, sesionId, limite = 8) {
  if (!sesionId || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const url = `${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/rpc/obtener_historial_sesion`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_sesion_id: sesionId, p_limite: limite })
    });
    if (!res.ok) return [];
    const filas = await res.json();
    return filas.map(f => ({
      role: f.rol === 'model' ? 'model' : 'user',
      parts: [{ text: f.contenido }]
    }));
  } catch {
    return [];
  }
}

// Alias para compatibilidad
export const recuperarHistorial = recuperarHistorialSesion;

export async function guardarTurnoConversacion(env, sesionId, userText, modelText) {
  if (!sesionId || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return;
  const url = `${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/chat_mensajes`;
  const payloads = [
    { sesion_id: sesionId, rol: 'user', contenido: userText },
    { sesion_id: sesionId, rol: 'model', contenido: modelText }
  ];
  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(payloads)
    });
  } catch (err) {
    console.warn('[Memoria] Error al persistir turno:', err.message);
  }
}

// Helper individual para compatibilidad
export async function guardarMensaje(env, { sesionId, rol, contenido, metadatos = {} }) {
  if (!sesionId || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return;
  const url = `${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/chat_mensajes`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        sesion_id: sesionId,
        rol: rol,
        contenido: contenido,
        metadatos: metadatos
      })
    });
  } catch (err) {
    console.warn('[Memoria] No se pudo persistir el mensaje:', err.message);
  }
}
