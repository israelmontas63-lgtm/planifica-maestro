/**
 * worker/services/cerebroMultimodal.js
 * 
 * CerebroMultimodal: Núcleo de Visión Interactiva y Razonamiento Multimodal de Planifica Maestro.
 * 
 * Capacidades:
 * 1. Entrada mixta: texto y partes inlineData (Base64 JPEG/PNG).
 * 2. System Prompt de tutor visual, diseñador de software y colega pedagógico.
 * 3. Ciclo de control de Tool Calling (máximo 4 iteraciones):
 *    a) consultar_curriculo (Supabase RPC buscar_curriculo_paginas).
 *    b) investigar_normativa_minerd (Tavily Search API restringida a dominios educativos).
 *    c) verificar_esquema_ddl (Supabase Management API para autodiagnóstico de tablas).
 * 4. Adaptador de endpoint con soporte de respuesta JSON y streaming SSE.
 */

export const SYSTEM_PROMPT_MULTIMODAL = `Eres el colega pedagógico de Planifica Maestro, diseñador de software y tutor interactivo experto en el currículo dominicano (MINERD y CON BASE).
Tus capacidades:
1. Análisis visual de interfaces y documentos: Cuando el usuario comparta una captura de pantalla, foto de interfaz o material didáctico, desglosa la pantalla con exactitud visual, señala los botones exactos a presionar, interpreta advertencias o textos de error y explica soluciones paso a paso.
2. Rigor curricular y pedagógico: Utiliza tus herramientas oficiales para contrastar citas pedagógicas oficiales, contenidos e indicadores de logro del MINERD.
3. Normativas y diagnóstico técnico: Consulta normativas oficiales dominicanas recientes y verifica la disponibilidad de tablas y esquemas en la base de datos cuando sea necesario.
4. Tono y comunicación: Profesional, directo, constructivo y colaborativo. Dirígete al docente con respeto y empatía, priorizando la acción inmediata y las instrucciones claras.`;

export class CerebroMultimodal {
  constructor(env = {}, options = {}) {
    this.env = env || {};
    this.fetchFn = options.fetchFn || ((...args) => globalThis.fetch(...args));
    this.modelName = this.env.GEMINI_VISION_MODEL || this.env.GEMINI_MODEL || "gemini-2.5-flash";
    this.apiKey = this.env.GEMINI_API_KEY || "";
    this.maxIteraciones = options.maxIteraciones || 4;
    this.systemPrompt = options.systemPrompt || SYSTEM_PROMPT_MULTIMODAL;
  }

  /**
   * Declaración formal de herramientas para Tool Calling
   */
  obtenerHerramientas() {
    return [
      {
        name: "consultar_curriculo",
        description: "Consulta citas oficiales, contenidos, indicadores y competencias en el currículo MINERD y CON BASE.",
        parameters: {
          type: "OBJECT",
          properties: {
            query_text: {
              type: "STRING",
              description: "Tema, término pedagógico o concepto curricular a consultar (ej: adición, silabario, numeración)."
            },
            p_grado: {
              type: "NUMBER",
              description: "Grado escolar numérico opcional (1 a 6)."
            }
          },
          required: ["query_text"]
        }
      },
      {
        name: "investigar_normativa_minerd",
        description: "Busca normativas, circulares oficiales, acuerdos y resoluciones educativas dominicanas en internet vía Tavily.",
        parameters: {
          type: "OBJECT",
          properties: {
            consulta: {
              type: "STRING",
              description: "Término o frase de búsqueda sobre normativas, calendarios o circulares del MINERD."
            }
          },
          required: ["consulta"]
        }
      },
      {
        name: "verificar_esquema_ddl",
        description: "Consulta administrativa de esquema en Supabase Management API para autodiagnóstico de tablas y funciones.",
        parameters: {
          type: "OBJECT",
          properties: {
            consulta_sql: {
              type: "STRING",
              description: "Consulta SQL de diagnóstico (ej: SELECT table_name FROM information_schema.tables WHERE table_schema='public')."
            }
          }
        }
      }
    ];
  }

  /**
   * Despacha la ejecución de la herramienta solicitada
   */
  async despacharHerramienta(nombre, args = {}) {
    switch (nombre) {
      case "consultar_curriculo": {
        const url = `${this.env.SUPABASE_URL}/rest/v1/rpc/buscar_curriculo_paginas`;
        const termino = args.query_text || args.termino || args.consulta || "";
        const grado = args.p_grado !== undefined ? args.p_grado : (args.grado !== undefined ? args.grado : null);

        const res = await this.fetchFn(url, {
          method: "POST",
          headers: {
            "apikey": this.env.SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": `Bearer ${this.env.SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            p_consulta: termino,
            p_grado_num: grado,
            query_text: termino,
            p_grado: grado
          })
        });

        if (!res.ok) {
          const errText = typeof res.text === "function" ? await res.text() : "";
          throw new Error(`Error en Supabase RPC (${res.status}): ${errText}`);
        }

        const data = typeof res.json === "function" ? await res.json() : [];
        return Array.isArray(data) ? data : [data];
      }

      case "investigar_normativa_minerd": {
        const query = args.consulta ? `${args.consulta} site:ministeriodeeducacion.gob.do` : "normativas minerd";
        const res = await this.fetchFn("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: this.env.TAVILY_API_KEY,
            query,
            include_domains: ["ministeriodeeducacion.gob.do", "mescyt.gob.do", "ideice.gob.do"],
            search_depth: "advanced",
            max_results: 3
          })
        });

        if (!res.ok) {
          const errText = typeof res.text === "function" ? await res.text() : "";
          throw new Error(`Error en Tavily Search (${res.status}): ${errText}`);
        }

        const data = typeof res.json === "function" ? await res.json() : {};
        return (data.results || []).map((r) => ({
          titulo: r.title,
          url: r.url,
          contenido: r.content
        }));
      }

      case "verificar_esquema_ddl": {
        const projectRef = this.env.SUPABASE_PROJECT_REF || "obcjdxearmmvtihfmtaa";
        const sql = args.consulta_sql || "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';";

        const res = await this.fetchFn(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${this.env.SUPABASE_ACCESS_TOKEN}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ query: sql })
        });

        if (!res.ok) {
          const errText = typeof res.text === "function" ? await res.text() : "";
          throw new Error(`Error en verificación DDL (${res.status}): ${errText}`);
        }

        let resData = null;
        if (typeof res.json === "function") {
          try { resData = await res.json(); } catch { resData = null; }
        }
        return {
          status: "success",
          resultado: resData
        };
      }

      default:
        throw new Error(`Herramienta no implementada: ${nombre}`);
    }
  }

  /**
   * Bucle de razonamiento con visión y ejecución autónoma (máximo 4 iteraciones)
   */
  async procesarMensaje({ mensaje = "", imagenBase64 = null, mimeType = "image/jpeg", historial = [] }) {
    const parts = [];

    if (imagenBase64) {
      const cleanData = String(imagenBase64).replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "").trim();
      parts.push({
        inlineData: {
          data: cleanData,
          mimeType: mimeType || "image/jpeg"
        }
      });
    }

    if (mensaje) {
      parts.push({ text: mensaje });
    }

    const contents = [...historial, { role: "user", parts }];
    const herramientasEjecutadas = [];

    let iteracion = 0;
    while (iteracion < this.maxIteraciones) {
      iteracion++;

      const apiKey = this.apiKey || this.env.GEMINI_API_KEY;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${apiKey}`;

      let res;
      try {
        res = await this.fetchFn(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents,
            systemInstruction: { parts: [{ text: this.systemPrompt }] },
            generationConfig: { temperature: 0.2 },
            tools: [{ functionDeclarations: this.obtenerHerramientas() }]
          })
        });
      } catch (netErr) {
        return {
          ok: false,
          error: `Fallo de red al conectar con Gemini: ${netErr.message}`,
          texto: "Hubo un problema de conexión al procesar la solicitud multimodal. Por favor, intenta de nuevo.",
          herramientasEjecutadas
        };
      }

      if (!res.ok) {
        const errText = typeof res.text === "function" ? await res.text() : "";
        return {
          ok: false,
          error: `Error HTTP ${res.status} de Gemini API: ${errText}`,
          texto: "El servicio cognitivo visual no pudo completar la solicitud en este momento.",
          herramientasEjecutadas
        };
      }

      let data;
      try {
        data = typeof res.json === "function" ? await res.json() : null;
      } catch {
        data = null;
      }

      const candidate = data?.candidates?.[0];
      if (!candidate || !candidate.content) {
        return {
          ok: false,
          error: "Respuesta nula o sin candidatos devuelta por el modelo.",
          texto: "No se pudo interpretar el contenido de la imagen o consulta.",
          herramientasEjecutadas
        };
      }

      const candidateParts = candidate.content.parts || [];
      const functionCalls = candidateParts.filter((p) => p.functionCall).map((p) => p.functionCall);

      if (functionCalls.length === 0) {
        // Respuesta final
        const texto = candidateParts.map((p) => p.text || "").join("");
        return {
          ok: true,
          texto,
          herramientasEjecutadas,
          historialActualizado: [...contents, candidate.content]
        };
      }

      // Procesar Tool Calls
      contents.push(candidate.content);
      const functionResponses = [];

      for (const call of functionCalls) {
        try {
          const resultado = await this.despacharHerramienta(call.name, call.args || {});
          herramientasEjecutadas.push({ nombre: call.name, args: call.args, resultado });
          functionResponses.push({
            functionResponse: {
              name: call.name,
              response: { output: resultado }
            }
          });
        } catch (errTool) {
          herramientasEjecutadas.push({ nombre: call.name, args: call.args, error: errTool.message });
          functionResponses.push({
            functionResponse: {
              name: call.name,
              response: { error: errTool.message }
            }
          });
        }
      }

      contents.push({ role: "user", parts: functionResponses });
    }

    return {
      ok: false,
      error: `Límite de ${this.maxIteraciones} iteraciones alcanzado sin respuesta final.`,
      texto: "Se completaron las llamadas a las herramientas, pero se alcanzó el límite de pasos de razonamiento.",
      herramientasEjecutadas
    };
  }
}

/**
 * Adaptador para conectar en el endpoint del asistente (JSON estructurado o SSE streaming)
 */
export async function manejarEndpointAsistente(payload, env, options = {}) {
  const mensaje = payload.mensaje || payload.prompt || (payload.messages && payload.messages[payload.messages.length - 1]?.text) || "";
  const imagenBase64 = payload.imagenBase64 || (payload.messages && payload.messages.find((m) => m.imageBase64)?.imageBase64) || null;
  const mimeType = payload.mimeType || payload.mediaType || "image/jpeg";
  const stream = Boolean(payload.stream);

  const cerebro = new CerebroMultimodal(env, options);
  const resultado = await cerebro.procesarMensaje({
    mensaje,
    imagenBase64,
    mimeType,
    historial: payload.historial || []
  });

  if (!stream) {
    return new Response(JSON.stringify({
      ok: resultado.ok,
      mensaje_chat: resultado.texto,
      modo: imagenBase64 ? "multimodal_vision" : "chat_pedagogico",
      herramientas: resultado.herramientasEjecutadas,
      error: resultado.error || null
    }), {
      status: resultado.ok ? 200 : 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Respuesta Streaming SSE
  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  (async () => {
    try {
      await writer.write(encoder.encode(`data: ${JSON.stringify({ estado: "analizando_multimodal" })}\n\n`));
      if (resultado.texto) {
        await writer.write(encoder.encode(`data: ${JSON.stringify({ delta: resultado.texto })}\n\n`));
      }
      await writer.write(encoder.encode(`data: ${JSON.stringify({
        final: {
          ok: resultado.ok,
          mensaje_chat: resultado.texto,
          modo: "multimodal_vision",
          herramientas: resultado.herramientasEjecutadas
        }
      })}\n\n`));
      await writer.write(encoder.encode("data: [DONE]\n\n"));
    } finally {
      writer.close();
    }
  })();

  return new Response(readable, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    }
  });
}
