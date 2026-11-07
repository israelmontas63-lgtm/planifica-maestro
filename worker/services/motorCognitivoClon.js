import { GoogleGenAI, Type } from '@google/genai';

/**
 * MotorCognitivoClon - Réplica de Arquitectura de Razonamiento Google
 * Entorno: Cloudflare Workers Edge / Node.js
 */
export class MotorCognitivoClon {
  constructor(env) {
    this.ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    this.supabaseUrl = env.SUPABASE_URL || `https://${env.SUPABASE_PROJECT_REF || 'obcjdxearmmvtihfmtaa'}.supabase.co`;
    this.serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  }

  // 1. Declaración Formal de Herramientas (JSON Schema según especificación OpenAPI)
  declararHerramientas() {
    return [{
      functionDeclarations: [
        {
          name: 'consultar_curriculo_minerd',
          description: 'Busca competencias, contenidos e indicadores en las 500 páginas de Adecuación Curricular y CON BASE en Supabase.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              termino: {
                type: Type.STRING,
                description: 'Concepto clave (ej. "sustracción", "comprensión oral", "noticia").'
              },
              grado: {
                type: Type.INTEGER,
                description: 'Grado primario (1 o 2 para multigrado, o 3).'
              }
            },
            required: ['termino', 'grado']
          }
        }
      ]
    }];
  }

  // 2. Ejecución de Búsqueda Curricular con Bucle de Autorreparación (Self-Healing)
  async ejecutarConsultaCurricular(termino, grado) {
    const endpoint = `${this.supabaseUrl}/rest/v1/rpc/buscar_curriculo_paginas`;
    
    // Intento 1: Búsqueda exacta
    let resultados = await this.realizarPeticionRPC(endpoint, termino, grado);
    
    // Intento 2 (Autorreparación): Si devuelve vacío, amplía a la familia conceptual
    if (!resultados || resultados.length === 0) {
      const terminoAmpliado = grado <= 2 ? 'alfabetizacion numeracion basica' : 'lengua espanola matematica general';
      resultados = await this.realizarPeticionRPC(endpoint, terminoAmpliado, grado);
    }

    return resultados || [];
  }

  async realizarPeticionRPC(endpoint, texto, grado) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'apikey': this.serviceKey,
          'Authorization': `Bearer ${this.serviceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query_text: texto,
          p_grado: grado,
          p_limite: 3
        })
      });
      return res.ok ? await res.json() : [];
    } catch {
      return [];
    }
  }

  // 3. Resolución Determinista de Incertidumbre (Smart Defaults)
  normalizarEntornoDocente(prompt) {
    const texto = (prompt || '').toLowerCase();
    
    let grado = 1;
    if (texto.includes('2do') || texto.includes('segundo') || texto.includes('2°')) grado = 2;
    if (texto.includes('3er') || texto.includes('tercero') || texto.includes('3°')) grado = 3;

    let area = 'Lengua Española';
    let termino = 'alfabetización y comprensión';

    if (texto.includes('matemática') || texto.includes('matematica') || texto.includes('números') || texto.includes('calculo')) {
      area = 'Matemática';
      termino = 'numeración y adición';
    } else if (texto.includes('sociales')) {
      area = 'Ciencias Sociales';
      termino = 'comunidad e identidad';
    } else if (texto.includes('naturales') || texto.includes('naturaleza')) {
      area = 'Ciencias de la Naturaleza';
      termino = 'materia y entorno';
    }

    return {
      docente: 'Israel Montás',
      escuela: 'Escuela Primaria Batey Pinos',
      modalidad: 'Multigrado (1.º y 2.º de Primaria)',
      duracion: '45 minutos',
      grado,
      area,
      termino
    };
  }

  // 4. Inferencia Cognitiva Orquestada
  async procesarPlanificacion(promptUsuario) {
    const entorno = this.normalizarEntornoDocente(promptUsuario);
    const evidencias = await this.ejecutarConsultaCurricular(entorno.termino, entorno.grado);

    const citasFormateadas = evidencias.length > 0 
      ? evidencias.map(e => `[Pág. ${e.pagina} - ${e.fuente_documento}]: ${e.texto}`).join('\n\n')
      : 'Documento base oficial: Adecuación Curricular del Nivel Primario (MINERD).';

    const systemPrompt = `
Eres el Núcleo de Razonamiento Experto de Planifica Maestro, operando bajo los estándares de precisión, grounding y concisión de Gemini.

I. REGLAS FUNDAMENTALES DE EJECUCIÓN:
1. CERO INTRODUCCIONES: Inicia en la primera línea directamente con la matriz o secuencia didáctica. Prohibido saludar o decir "¡Claro!".
2. METADATOS DOCENTES ASUMIDOS:
   - Docente: ${entorno.docente}
   - Escuela: ${entorno.escuela}
   - Nivel: ${entorno.modalidad}
   - Asignatura: ${entorno.area}
   - Grado: ${entorno.grado}° de Primaria
   - Duración: ${entorno.duracion}
3. GROUNDING OBLIGATORIO:
   Usa exclusivamente las evidencias curriculares oficiales suministradas a continuación. Cita el número de página oficial recuperado.
${citasFormateadas}
4. ESTRUCTURA DIDÁCTICA EN TRES MOMENTOS (45 MINUTOS):
   - Inicio (10 min): Recuperación de saberes previos y propósito pedagógico.
   - Desarrollo (25 min): Actividades prácticas articuladas y diferenciadas para 1.º y 2.º grado, modelado docente y recursos del entorno.
   - Cierre (10 min): Evaluación formativa, metacognición ("¿qué aprendimos y para qué sirve?") y síntesis.
5. CALIDAD DEL ARTEFACTO: Entrega el contenido 100% terminado; prohibido usar etiquetas vacías o delegar trabajo con "[Completar]".
`.trim();

    const response = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: promptUsuario,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.2, // Evita variabilidad y alucinación
        maxOutputTokens: 2500
      }
    });

    return response.text;
  }
}
