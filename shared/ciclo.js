/**
 * shared/ciclo.js
 * 
 * Ciclo Oficial de Tool Calling de Planifica Maestro.
 * Manejo inmutable de historial, preservación de thoughtSignature,
 * auditoría de consultas realizadas y limitador de iteraciones.
 */

import { responderLlamadas } from './herramientas.mjs';

export const HERRAMIENTAS_DECLARACION = [
  {
    name: 'consultar_base_datos',
    description: 'Consulta los fragmentos y contenidos curriculares oficiales del MINERD en la base de datos oficial. En aulas multigrado, realiza una llamada independiente por cada grado escolar involucrado.',
    parameters: {
      type: 'OBJECT',
      properties: {
        nivel: { 
          type: 'STRING', 
          enum: ['Inicial', 'Primario', 'Secundario'], 
          description: 'Nivel educativo oficial' 
        },
        grado: { 
          type: 'STRING', 
          enum: ['1ro', '2do', '3ro', '4to', '5to', '6to'], 
          description: 'Grado escolar específico (1ro a 6to)' 
        },
        area: { 
          type: 'STRING', 
          description: 'Área curricular oficial (ej. Matemática, Lengua Española)' 
        },
        tema_o_concepto: { 
          type: 'STRING', 
          description: 'Tema, concepto o contenido curricular a articular' 
        }
      },
      required: ['nivel', 'grado', 'area', 'tema_o_concepto']
    }
  }
];

export async function cicloToolCalling({
  promptUsuario,
  llamadaModeloIA,
  ejecutorSupabase,
  maxIteraciones = 3,
  env = {}
}) {
  const tools = [{ functionDeclarations: HERRAMIENTAS_DECLARACION }];
  const contents = [
    {
      role: 'user',
      parts: [{ text: promptUsuario }]
    }
  ];

  const consultasAuditadas = [];
  let huboLlamadas = false;

  for (let iteracion = 0; iteracion < maxIteraciones; iteracion++) {
    const payload = { contents: [...contents], tools };
    const respuesta = await llamadaModeloIA(payload);

    const candidate = respuesta?.candidates?.[0];
    if (!candidate || candidate.finishReason === 'SAFETY') {
      return {
        tipo: 'error',
        motivo: candidate?.finishReason || 'RESPUESTA_VACIA_O_BLOQUEADA',
        iteraciones: iteracion + 1,
        consultas: consultasAuditadas,
        contents
      };
    }

    const modelContent = candidate.content || { role: 'model', parts: [] };
    const parts = modelContent.parts || [];

    // Preservar íntegramente la respuesta del modelo en contents (incluyendo firmas de razonamiento)
    contents.push({
      role: 'model',
      parts
    });

    // Detectar functionCall
    const functionCalls = parts
      .filter(p => Boolean(p.functionCall))
      .map(p => p.functionCall);

    if (functionCalls.length === 0) {
      const textoFinal = parts.map(p => p.text || '').join('').trim();
      const huboErrorIteracion = consultasAuditadas.some(c => Boolean(c.error));

      if (!huboLlamadas || huboErrorIteracion) {
        return {
          tipo: 'directa',
          texto: textoFinal,
          iteraciones: iteracion + 1,
          consultas: consultasAuditadas,
          contents
        };
      }

      return {
        tipo: 'tool_calling_completado',
        texto: textoFinal,
        iteraciones: iteracion + 1,
        consultas: consultasAuditadas,
        contents
      };
    }

    // Ejecución de llamadas
    huboLlamadas = true;
    const opts = typeof ejecutorSupabase === 'function' ? { ejecutor: ejecutorSupabase } : (ejecutorSupabase || {});
    const userTurn = await responderLlamadas(functionCalls, env, opts);

    // Auditoría de cada llamada
    userTurn.parts.forEach((p, idx) => {
      const call = functionCalls[idx];
      const resp = p.functionResponse?.response;
      consultasAuditadas.push({
        nombre: call?.name,
        args: call?.args,
        filas: resp?.resultado || [],
        source_ids: (resp?.resultado || []).map(r => r.source_id).filter(Boolean),
        error: resp?.error || null,
        aviso_validacion: resp?.aviso_validacion || null
      });
    });

    contents.push(userTurn);
  }

  return {
    tipo: 'limite_iteraciones',
    iteraciones: maxIteraciones,
    consultas: consultasAuditadas,
    contents
  };
}
