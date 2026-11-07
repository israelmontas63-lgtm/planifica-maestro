import { CerebroRobot } from '../services/cerebroRobot.js';
import { AuditorPedagogico } from '../services/auditorPedagogico.js';

/**
 * Manejador HTTP para generación de planificaciones
 * Runtime: Cloudflare Workers (V8 JavaScript)
 */
export async function manejarSolicitudPlanificacion(request, env) {
  // 1. Control de método HTTP
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ 
      exito: false, 
      error: 'Método no permitido. Utilice POST.' 
    }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const cuerpo = await request.json();
    const promptDocente = (cuerpo.prompt || cuerpo.mensaje || '').trim();

    if (!promptDocente) {
      return new Response(JSON.stringify({ 
        exito: false, 
        error: 'El prompt de planificación es obligatorio.' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Instanciación del motor cognitivo
    const cerebro = new CerebroRobot(env);
    
    // 3. Procesamiento con Grounding en Supabase y doble modo
    const resultado = await cerebro.procesarMensaje(promptDocente, [], {
      historial: Array.isArray(cuerpo.historial) ? cuerpo.historial : [],
      nivel: cuerpo.nivel,
      grado: cuerpo.grado
    });

    // 4. Auto-Auditoría previa a la respuesta
    const auditoria = AuditorPedagogico.auditarPlanificacion(
      resultado.contenido || resultado, 
      resultado.evidencias || []
    );

    // 5. Sustitución de cualquier mención residual de IA por la marca oficial
    let textoFinal = (typeof resultado === 'string' ? resultado : (resultado.contenido || JSON.stringify(resultado)))
      .replace(/generado por (ia|inteligencia artificial)/gi, 'Planifica Maestro')
      .replace(/modelo de lenguaje/gi, 'Planifica Maestro');

    return new Response(JSON.stringify({
      exito: true,
      sistema: 'Planifica Maestro — Sistema de Gestión y Planificación Docente',
      auditoria: {
        aprobado: auditoria.aprobado,
        dictamen: auditoria.dictamen
      },
      planificacion: textoFinal,
      asesor: resultado.asesor || null,
      evidencias: resultado.evidencias || []
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      exito: false,
      sistema: 'Planifica Maestro',
      error: error.message || 'Fallo interno en el pipeline de planificación.'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
