/**
 * scripts/prueba_real_gemini.mjs
 * 
 * Script de prueba de integración de Gemini con ciclo de Function Calling curricular.
 * Si GEMINI_API_KEY está configurada en el entorno, ejecuta la llamada real a la API.
 * Si no está disponible, simula el ciclo de 2 turnos de forma determinista para verificación.
 */

import { cicloToolCalling } from '../shared/ciclo.js';
import { PROMPT_SISTEMA_V2_TEXTO } from '../shared/promptSistemaV2.js';

async function ejecutarPrueba() {
  console.log('=================================================================');
  console.log('🤖 PRUEBA DE CICLO CURRICULAR: GEMINI + FUNCTION CALLING (MINERD)');
  console.log('=================================================================\n');

  const apiKey = process.env.GEMINI_API_KEY;
  const promptDocente = 'Hola colega, necesito planificar una clase de Matemática para 2do Grado de Primaria sobre adición con reagrupación.';

  console.log(`📝 Consulta del docente:\n   "${promptDocente}"\n`);

  // Mock de datos curriculares oficiales para el ejecutor
  const fragmentosOficiales = [
    {
      id: 'f87a8b41-e37d-5a9a-b85f-8d99c424a180',
      source_id: 'matriz_matematica_secuencia_2_segundo',
      nivel: 'primario',
      grado_num: 2,
      area: 'Matemática',
      tema: 'Numeración y Adición',
      competencia_especifica: 'Aplica conceptos y algoritmos de suma con números naturales hasta el 999 reagrupando decenas.',
      indicador_logro: 'Resuelve operaciones de adición con números naturales hasta tres dígitos reagrupando unidades y decenas en contextos cotidianos.',
      fuente_documento: 'Guía Didáctica de Matemática (MINERD / CON BASE)',
      version_curricular: '2023',
      pagina: 40,
      estado_validacion: 'validado'
    }
  ];

  if (apiKey && apiKey.trim().length > 10) {
    console.log('🔑 GEMINI_API_KEY detectada en el entorno. Intentando conexión real con Gemini...');
    const modelo = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    try {
      const resultado = await cicloToolCalling({
        promptUsuario: promptDocente,
        llamadaModeloIA: async (payload) => {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: payload.contents,
              tools: payload.tools,
              systemInstruction: { parts: [{ text: PROMPT_SISTEMA_V2_TEXTO }] },
              generationConfig: { temperature: 0.1, maxOutputTokens: 2048 }
            })
          });

          if (!res.ok) {
            const errBody = await res.text();
            throw new Error(`Error HTTP ${res.status}: ${errBody}`);
          }
          return await res.json();
        },
        ejecutorSupabase: async (args) => {
          console.log('\n🔍 [Supabase Ejecutor] Consulta recibida desde Gemini:', JSON.stringify(args, null, 2));
          return fragmentosOficiales;
        },
        maxIteraciones: 3
      });

      console.log('\n✅ Ciclo en vivo completado exitosamente con Gemini:');
      console.log(`   Tipo de respuesta: ${resultado.tipo}`);
      console.log(`   Iteraciones realizadas: ${resultado.iteraciones}`);
      console.log(`   Herramientas auditadas: ${resultado.consultas.length}`);
      console.log('\n📄 Texto devuelto por el modelo:\n');
      console.log(resultado.texto);
      return;
    } catch (errReal) {
      console.warn(`\n⚠️ Falló la llamada en vivo a Gemini (${errReal.message}).`);
      console.log('   Pasando a simulación determinista para validar el ciclo...\n');
    }
  } else {
    console.log('ℹ️ No se detectó GEMINI_API_KEY en variables de entorno.');
    console.log('   Ejecutando simulación determinista del ciclo de Tool Calling...\n');
  }

  // Simulación determinista del ciclo de Gemini Function Calling
  let turno = 0;
  const modeloSimulado = async (payload) => {
    turno++;
    if (turno === 1) {
      console.log('🔄 [Turno 1 - Modelo]: Gemini analiza el prompt y detecta necesidad de consultar la base curricular.');
      console.log('   -> Genera Function Call: consultar_base_datos');
      return {
        candidates: [{
          content: {
            role: 'model',
            parts: [{
              functionCall: {
                name: 'consultar_base_datos',
                args: {
                  nivel: 'Primario',
                  grado: '2do Grado',
                  area: 'Matemática',
                  tema_o_concepto: 'Adición'
                }
              }
            }]
          }
        }]
      };
    } else {
      console.log('🔄 [Turno 2 - Modelo]: Gemini recibe los fragmentos oficiales y redacta la planificación articulada.');
      return {
        candidates: [{
          content: {
            role: 'model',
            parts: [{
              text: `¡Saludos, colega! Con gusto te acompaño en la planificación de Matemática para 2do Grado de Primaria.

### 📚 Articulación Curricular Oficial (MINERD)
- **Competencia Específica:** Aplica conceptos y algoritmos de suma con números naturales hasta el 999 reagrupando decenas.
- **Indicador de Logro:** Resuelve operaciones de adición con números naturales hasta tres dígitos reagrupando unidades y decenas en contextos cotidianos.
- **Fuente Oficial:** Guía Didáctica de Matemática (MINERD / CON BASE, versión 2023, pág. 40).

### ✏️ Secuencia Didáctica Sugerida
1. **Inicio (10 min):** Planteamiento de una situación de compra en el colmado escolar con bloques multibase.
2. **Desarrollo (30 min):** Algoritmo de adición reagrupando 10 unidades en una decena.
3. **Cierre (10 min):** Reflexión colectiva y verificación en el cuaderno.`
            }]
          }
        }]
      };
    }
  };

  const resultadoSim = await cicloToolCalling({
    promptUsuario: promptDocente,
    llamadaModeloIA: modeloSimulado,
    ejecutorSupabase: async (args) => {
      console.log('🔍 [Supabase Ejecutor]: Consulta procesada con argumentos:', JSON.stringify(args));
      return fragmentosOficiales;
    },
    maxIteraciones: 3
  });

  console.log('\n=================================================================');
  console.log('✅ RESULTADO FINAL DE LA AUDITORÍA DE TOOL CALLING');
  console.log('=================================================================');
  console.log(`Tipo: ${resultadoSim.tipo}`);
  console.log(`Iteraciones: ${resultadoSim.iteraciones}`);
  console.log(`Consultas auditadas: ${resultadoSim.consultas.length}`);
  console.log('Detalle de auditoría de consultas:', JSON.stringify(resultadoSim.consultas, null, 2));
  console.log('\nRespuesta devuelta al docente:\n');
  console.log(resultadoSim.texto);
}

ejecutarPrueba().catch(err => {
  console.error('Error en prueba:', err);
  process.exit(1);
});
