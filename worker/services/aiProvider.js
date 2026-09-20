/**
 * worker/services/aiProvider.js
 * Capa de Abstracción de Proveedor de IA (Intercambiable)
 * Soporta Google Gemini como proveedor principal (chat, embeddings, function calling)
 */

export class AiProvider {
  /**
   * Genera una respuesta conversacional o estructurada
   * @param {Object} options
   * @param {Array} options.messages - Historial de mensajes en formato estándar
   * @param {Array} [options.tools] - Declaración de herramientas / funciones
   * @param {string} [options.systemInstruction] - Instrucción del sistema
   * @param {boolean} [options.stream] - Indica si la respuesta es SSE
   * @param {string} [options.responseMimeType] - 'application/json' o 'text/plain'
   */
  async generateChat(options) {
    throw new Error("generateChat no implementado en proveedor base");
  }

  /**
   * Genera el embedding vectorial normalizado L2
   * @param {Object} options
   * @param {string} options.text - Texto a vectorizar
   * @param {number} [options.dimensions] - Dimensión del vector (default: 768)
   */
  async embedContent(options) {
    throw new Error("embedContent no implementado en proveedor base");
  }
}

export class GeminiProvider extends AiProvider {
  constructor(apiKey, model = "gemini-2.5-flash") {
    super();
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY no está configurada.");
    }
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateChat({ messages, tools, systemInstruction, stream = false, responseMimeType = "text/plain" }) {
    const endpoint = stream ? "streamGenerateContent?alt=sse&" : "generateContent?";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:${endpoint}key=${this.apiKey}`;

    const bodyPayload = {
      contents: messages,
      generationConfig: {
        temperature: 0.2,
        responseMimeType: responseMimeType,
      },
    };

    if (systemInstruction) {
      bodyPayload.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    if (tools && tools.length > 0) {
      bodyPayload.tools = [{ functionDeclarations: tools }];
    }

    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyPayload),
    });
  }

  async embedContent({ text, dimensions = 768 }) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${this.apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/text-embedding-004",
        content: { parts: [{ text }] },
        outputDimensionality: dimensions,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Error en Gemini Embeddings (${res.status}): ${err}`);
    }

    const data = await res.json();
    const rawVector = data.embedding?.values || [];
    if (rawVector.length === 0) {
      throw new Error("Gemini devolvió un vector de embedding vacío.");
    }

    // Normalización L2 obligatoria
    const norm = Math.sqrt(rawVector.reduce((sum, v) => sum + v * v, 0)) || 1.0;
    return rawVector.map((v) => v / norm);
  }
}

/**
 * Factoría para obtener el proveedor de IA configurado en el entorno
 * @param {Object} env - Variables de entorno de Cloudflare Worker
 */
export function getAiProvider(env) {
  const provider = env.AI_PROVIDER || "gemini";
  if (provider === "gemini") {
    return new GeminiProvider(env.GEMINI_API_KEY, env.GEMINI_MODEL || "gemini-2.5-flash");
  }
  throw new Error(`Proveedor de IA '${provider}' no soportado.`);
}
