import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AuditorPedagogico } from '../worker/services/auditorPedagogico.js';
import { CerebroRobot } from '../worker/services/cerebroRobot.js';

describe('Compuerta de Auto-Auditoría y Certificación Curricular (AuditorPedagogico)', () => {
  const evidenciasMock = [
    { pagina: 48, fuente_documento: 'Adecuación Curricular MINERD', texto: 'Contenido conceptual de adición' },
    { pagina: 84, fuente_documento: 'Guía Metodológica CON BASE', texto: 'Estrategia con letras móviles' }
  ];

  it('debe rechazar planificaciones vacías o nulas', () => {
    const resVacio = AuditorPedagogico.auditarPlanificacion('');
    assert.equal(resVacio.aprobado, false);
    assert.equal(resVacio.certificado, false);
    assert.ok(resVacio.faltas.length > 0);

    const resNull = AuditorPedagogico.auditarPlanificacion(null);
    assert.equal(resNull.aprobado, false);
  });

  it('debe rechazar textos que contengan marcadores incompletos como [completar o [insertar', () => {
    const textoIncompleto = `
      # Planificación de Lengua Española
      [completar área y grado]
      ### Inicio (10 min)
      Motivación y saberes previos.
      ### Desarrollo (25 min)
      Trabajo alternado en el aula.
      ### Cierre (10 min)
      Metacognición y síntesis.
      Referencia: Pág. 48.
    `;

    const res = AuditorPedagogico.auditarPlanificacion(textoIncompleto, evidenciasMock);
    assert.equal(res.aprobado, false);
    assert.equal(res.certificado, false);
    assert.ok(res.faltas.some(f => f.includes('[completar')));
    assert.equal(res.metricas.sinMarcadoresIncompletos, false);
  });

  it('debe rechazar textos que contengan puntos suspensivos (...) de contenido incompleto', () => {
    const textoConPuntos = `
      # Planificación de Matemática
      ### Inicio (10 min)
      Saberes previos...
      ### Desarrollo (25 min)
      Actividades con bloques multibase...
      ### Cierre (10 min)
      Evaluación formativa...
      Referencia: Pág. 48.
    `;

    const res = AuditorPedagogico.auditarPlanificacion(textoConPuntos, evidenciasMock);
    assert.equal(res.aprobado, false);
    assert.ok(res.faltas.some(f => f.includes('...')));
    assert.equal(res.metricas.sinMarcadoresIncompletos, false);
  });

  it('debe rechazar textos que omitan alguno de los tres momentos obligatorios (Inicio, Desarrollo, Cierre)', () => {
    // Falta Desarrollo
    const textoSinDesarrollo = `
      # Planificación
      ### Inicio (10 min)
      Dinámica de integración.
      ### Cierre (10 min)
      Preguntas de metacognición.
      Referencia: Pág. 48.
    `;

    const res = AuditorPedagogico.auditarPlanificacion(textoSinDesarrollo, evidenciasMock);
    assert.equal(res.aprobado, false);
    assert.equal(res.metricas.momentosCompletos, false);
    assert.ok(res.faltas.some(f => f.includes('Desarrollo')));
  });

  it('debe rechazar textos que no citen las páginas oficiales de las evidencias de Supabase', () => {
    const textoSinPaginas = `
      # Planificación Multigrado
      ### Inicio (10 min)
      Recuperación de conocimientos previos.
      ### Desarrollo (25 min)
      Mediación directa y actividades semi-autónomas.
      ### Cierre (10 min)
      Evaluación en plenaria.
    `;

    const res = AuditorPedagogico.auditarPlanificacion(textoSinPaginas, evidenciasMock);
    assert.equal(res.aprobado, false);
    assert.equal(res.metricas.citasValidas, false);
    assert.ok(res.hallazgos.some(f => f.includes('evidencias oficiales')));
    assert.match(res.dictamen, /RECHAZADO/);
  });

  it('debe certificar y aprobar textos completos que cumplan todos los requisitos pedagógicos y normativos', () => {
    const textoValido = `
      # Planificación de Aula Multigrado (1.° y 2.° Grado)
      **Docente:** Israel Montás | **Centro:** Escuela Primaria Batey Pinos
      **Eje Temático:** El Letrero y su función social
      **Fuente Curricular:** Adecuación Curricular MINERD (Pág. 48) y CON BASE (Pág. 84)

      ### Inicio (10 minutos)
      Recuperación de experiencias previas explorando carteles y letreros del entorno escolar.

      ### Desarrollo (25 minutos)
      - Tramo 1 (Minutos 1-12): Modelado docente con 1.º grado en correspondencia fonema-grafema.
      - Tramo 2 (Minutos 13-20): Acompañamiento a 2.º grado en producción de letreros categorizados.
      - Tramo 3 (Minutos 21-25): Plenaria de socialización e intercambio de producciones.

      ### Cierre (10 minutos)
      Evaluación metacognitiva grupal: ¿Para qué sirven los letreros en nuestra comunidad?
    `;

    const res = AuditorPedagogico.auditarPlanificacion(textoValido, evidenciasMock);
    assert.equal(res.aprobado, true);
    assert.equal(res.certificado, true);
    assert.equal(res.hallazgos.length, 0);
    assert.match(res.dictamen, /CERTIFICADO/);
    assert.equal(res.certificadoPor, 'AuditorPedagogico_PlanificaMaestro_v1');
    assert.ok(res.marcaTiempoAST);
    assert.equal(res.metricas.sinMarcadoresIncompletos, true);
    assert.equal(res.metricas.momentosCompletos, true);
    assert.equal(res.metricas.citasValidas, true);
  });

  it('debe ejecutar el reintento de autocorrección inmediata en CerebroRobot si la auditoría detecta faltas', async () => {
    const envMock = {
      GEMINI_API_KEY: 'test-key',
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-key'
    };

    const cerebro = new CerebroRobot(envMock);

    let llamadasGenerate = 0;
    let recibioPromptCorreccion = false;

    cerebro.ai = {
      models: {
        generateContent: async ({ contents }) => {
          llamadasGenerate++;

          if (llamadasGenerate === 1) {
            // Emite primera respuesta con falta (marcador incompleto y sin cierre)
            return {
              candidates: [{
                content: {
                  parts: [{
                    text: '# Planificación incompleta\n[completar]\n### Inicio (10 min)\nActividad inicial.\n### Desarrollo (25 min)\nActividad central.'
                  }]
                }
              }]
            };
          }

          // Segunda llamada: verifica que recibió la solicitud de auto-corrección
          const ultimoMensaje = contents[contents.length - 1];
          recibioPromptCorreccion = ultimoMensaje.parts.some(p =>
            p.text && p.text.includes('[AUTO-AUDITORÍA PEDAGÓGICA - REINTENTO DE AUTO-CORRECCIÓN]')
          );

          // Devuelve respuesta corregida y completa
          return {
            candidates: [{
              content: {
                parts: [{
                  text: '# Planificación Corregida\n### Inicio (10 min)\nActividad.\n### Desarrollo (25 min)\nActividad central.\n### Cierre (10 min)\nEvaluación final.'
                }]
              }
            }]
          };
        }
      }
    };

    const res = await cerebro.procesarMensaje({ mensaje: 'Planifica una clase de ciencias' });

    assert.equal(llamadasGenerate, 2);
    assert.equal(recibioPromptCorreccion, true);
    assert.equal(res.auditoria.aprobado, true);
    assert.ok(res.texto.includes('Planificación Corregida'));
  });

  it('debe ejecutar generarYAuditarPlan con auto-reparación guiada por auditoria.hallazgos', async () => {
    const envMock = {
      GEMINI_API_KEY: 'test-key',
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-key'
    };

    const cerebro = new CerebroRobot(envMock);
    let intentosMock = 0;
    let promptRecibidoEnIntento2 = '';

    cerebro.invocarModeloGemini = async (prompt, evs) => {
      intentosMock++;
      if (intentosMock === 1) {
        return '# Borrador incompleto\n### Inicio (10 min)\nInicio.\n### Desarrollo (25 min)\nDesarrollo.\nPág. 48';
      }
      promptRecibidoEnIntento2 = prompt;
      return '# Plan Certificado\n### Inicio (10 min)\nInicio.\n### Desarrollo (25 min)\nDesarrollo.\n### Cierre (10 min)\nCierre.\nPág. 48';
    };

    const resultado = await cerebro.generarYAuditarPlan('Planifica clase de lectura', [{ pagina: 48 }]);

    assert.equal(intentosMock, 2);
    assert.ok(promptRecibidoEnIntento2.includes('[REPARACIÓN OBLIGATORIA: Corregir las siguientes observaciones detectadas por el auditor interno:'));
    assert.equal(resultado.auditoria.aprobado, true);
    assert.match(resultado.auditoria.dictamen, /CERTIFICADO/);
    assert.ok(resultado.contenido.includes('# Plan Certificado'));
  });

  it('debe certificar planificaciones de Nivel Inicial estructuradas en Momentos de la Rutina (Resolución 09-2023)', () => {
    const textoInicial = `
      # Planificación de Nivel Inicial (Pre-Primario)
      **Centro:** Escuela Primaria Batey Pinos
      **Base Legal:** Adecuación Curricular del Nivel Inicial (Resolución 09-2023)
      **Referencia:** Pág. 32

      ### Encuentro de Grupo (45 min)
      Conversación sobre los animales de la granja y ronda infantil.

      ### Actividad Grupal: Grupo Grande y Grupo Pequeño
      - Grupo Grande: Modelado con plastilina de formas animales.
      - Grupo Pequeño: Exploración sensorial con plumas y semillas.

      ### Juego-Trabajo en Zonas de Interés
      Construcción libre en la zona de bloques y dramatización.
    `;

    const res = AuditorPedagogico.auditarPlanificacion(textoInicial, [{ pagina: 32 }]);
    assert.equal(res.aprobado, true);
    assert.match(res.dictamen, /CERTIFICADO/);
  });
});
