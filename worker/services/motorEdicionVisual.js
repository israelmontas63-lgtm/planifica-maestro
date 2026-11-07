import { GoogleGenAI } from '@google/genai';
import { GestorArchivos } from './gestorArchivos.js';

/**
 * Motor de Edición y Generación Visual - Planifica Maestro
 * Pipeline de dos etapas:
 *  1. Análisis y formulación de prompt técnico (Gemini 2.5 Flash)
 *  2. Renderizado gráfico y estilización (Imagen 3 API / Generación Visual)
 */
export class MotorEdicionVisual {
  constructor(env = {}, options = {}) {
    this.env = env || {};
    this.apiKey = this.env.GEMINI_API_KEY || '';
    this.ai = this.env.ai || (this.apiKey ? new GoogleGenAI({ apiKey: this.apiKey }) : null);
    this.gestorArchivos = this.env.gestorArchivos || new GestorArchivos(this.env);
    this.fetchFn = options.fetchFn || ((...args) => globalThis.fetch(...args));
    this.modeloAnalisis = 'gemini-2.5-flash';
    this.modeloImagen = 'imagen-3.0-generate-002';
  }

  /**
   * Etapa 1: Análisis cognitivo con Gemini 2.5 Flash
   * Descompone la imagen base y traduce la intención del usuario a un prompt técnico enriquecido.
   */
  async formularPromptEdicion({ imagenBase64, mimeType = 'image/jpeg', instruccionUsuario }) {
    if (!imagenBase64 || !instruccionUsuario) {
      throw new Error('Se requiere la imagen base y la instrucción de edición del usuario.');
    }

    const dataLimpia = imagenBase64.replace(/^data:image\/\w+;base64,/, '');

    const systemPrompt = `Eres un Director de Arte Técnico especializado en generación de imágenes con Google Imagen 3.
Tu misión:
1. Inspecciona minuciosamente la imagen proporcionada (sujeto principal, composición, proporciones, ángulo).
2. Comprende el cambio estético o funcional pedido por el usuario (ej: fondo, color, textura, render 3D, ilustración didáctica).
3. Formula un prompt técnico en inglés de alta fidelidad, fotorrealista o estilizado según se solicite, describiendo el sujeto que debe preservarse, la nueva atmósfera, iluminación de estudio, materiales (ej: matte finish, 3D clay render, vibrant blue backdrop) y detalles de cámara.
4. Devuelve ÚNICAMENTE el texto del prompt técnico, sin explicaciones ni saludos.`;

    // 1. Vía SDK GoogleGenAI si está disponible
    if (this.ai && this.ai.models && typeof this.ai.models.generateContent === 'function') {
      const res = await this.ai.models.generateContent({
        model: this.modeloAnalisis,
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType, data: dataLimpia } },
              { text: `Instrucción del usuario: "${instruccionUsuario}". Formula el prompt técnico de edición en inglés:` }
            ]
          }
        ],
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.3
        }
      });

      const promptGenerado = res.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      return promptGenerado || instruccionUsuario;
    }

    // 2. Vía REST directo de Gemini
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modeloAnalisis}:generateContent?key=${this.apiKey}`;
    const payload = {
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: dataLimpia } },
            { text: `Instrucción del usuario: "${instruccionUsuario}". Formula el prompt técnico de edición en inglés:` }
          ]
        }
      ],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: { temperature: 0.3 }
    };

    const res = await this.fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Error en análisis de edición visual (${res.status}): ${err}`);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || instruccionUsuario;
  }

  /**
   * Etapa 2: Motor Gráfico (Imagen 3 API)
   * Renderiza la nueva imagen a partir del prompt técnico estructurado.
   */
  async renderizarImagen({ promptTecnico, aspectRatio = '1:1', sampleCount = 1 }) {
    if (!promptTecnico) {
      throw new Error('Se requiere un prompt técnico para renderizar la imagen.');
    }

    // 1. Intento vía SDK generateImages
    if (this.ai && this.ai.models && typeof this.ai.models.generateImages === 'function') {
      try {
        const respuesta = await this.ai.models.generateImages({
          model: this.modeloImagen,
          prompt: promptTecnico,
          config: {
            numberOfImages: sampleCount,
            outputMimeType: 'image/jpeg',
            aspectRatio: aspectRatio
          }
        });

        const imagenData = respuesta.generatedImages?.[0]?.image?.imageBytes;
        if (imagenData) {
          return {
            imagenBase64: `data:image/jpeg;base64,${imagenData}`,
            mimeType: 'image/jpeg',
            modeloUsado: this.modeloImagen
          };
        }
      } catch (err) {
        console.warn('[MotorEdicionVisual] SDK generateImages falló, intentando REST directo:', err.message);
      }
    }

    // 2. Vía REST directo de Imagen 3 (predict endpoint)
    const urlPredict = `https://generativelanguage.googleapis.com/v1beta/models/${this.modeloImagen}:predict?key=${this.apiKey}`;
    const payload = {
      instances: [{ prompt: promptTecnico }],
      parameters: {
        sampleCount: sampleCount,
        aspectRatio: aspectRatio,
        outputOptions: { mimeType: 'image/jpeg' }
      }
    };

    const res = await this.fetchFn(urlPredict, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Error en renderizado con Imagen 3 (${res.status}): ${err}`);
    }

    const data = await res.json();
    const b64 = data.predictions?.[0]?.bytesBase64Encoded;

    if (!b64) {
      throw new Error('La API de Imagen 3 no devolvió datos de imagen válidos.');
    }

    return {
      imagenBase64: `data:image/jpeg;base64,${b64}`,
      mimeType: 'image/jpeg',
      modeloUsado: this.modeloImagen
    };
  }

  /**
   * Pipeline Completo: Cerebro (Gemini 2.5) -> Motor Gráfico (Imagen 3) -> Persistencia en Storage
   */
  async procesarEdicionCompleta({ imagenBase64, mimeType = 'image/jpeg', instruccionUsuario, sesionId = 'edicion_visual' }) {
    // 1. Cerebro formula el prompt técnico
    const promptTecnico = await this.formularPromptEdicion({ imagenBase64, mimeType, instruccionUsuario });

    // 2. Motor gráfico renderiza la nueva imagen
    const resultadoRender = await this.renderizarImagen({ promptTecnico });

    // 3. Almacenamiento frío de la nueva imagen en Supabase Storage
    let archivoId = null;
    let archivoUrl = null;
    try {
      const subida = await this.gestorArchivos.subirImagenBase64(resultadoRender.imagenBase64, resultadoRender.mimeType);
      archivoId = subida?.archivoId || null;
      archivoUrl = subida?.archivoUrl || null;
    } catch (err) {
      console.warn('[MotorEdicionVisual] Fallo al subir imagen editada a Storage:', err.message);
    }

    return {
      exito: true,
      instruccionOriginal: instruccionUsuario,
      promptTecnico: promptTecnico,
      imagenEditadaBase64: resultadoRender.imagenBase64,
      archivoId: archivoId,
      archivoUrl: archivoUrl,
      modeloUsado: resultadoRender.modeloUsado
    };
  }
}
